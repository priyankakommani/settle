import { rfc2822ToIso } from '../lib/dates.js';
import type { ParsedAttachment, ParsedEmail } from './types.js';

/**
 * Parse a raw .eml buffer into `ParsedEmail`: headers, a plain-text body, and
 * any attachments. A small hand-rolled MIME reader — no mail service, no
 * dependency. Handles the common real-world shapes beyond the sample pack's
 * simple text/plain messages:
 *  - quoted-printable and base64 encoded bodies/attachments
 *  - nested multipart (e.g. multipart/alternative inside multipart/mixed)
 *  - HTML-only messages (falls back to a stripped-text rendering of the HTML
 *    part when there is no text/plain part)
 */
export function parseEmail(raw: Buffer): ParsedEmail {
  const text = raw.toString('utf8');
  const { headerBlock, body } = splitHeaderBody(text);
  const headers = parseHeaders(headerBlock);

  const { textBody, htmlBody, attachments } = extractBody(headers, body);

  return {
    from: cleanAddr(headers['from']),
    to: (headers['to'] ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    subject: headers['subject'] ?? null,
    date: rfc2822ToIso(headers['date']),
    messageId: stripAngles(headers['message-id']),
    inReplyTo: stripAngles(headers['in-reply-to']),
    textBody: textBody.trim() || htmlToText(htmlBody).trim(),
    attachments,
  };
}

/* ------------------------------------------------------------------ */

interface BodyResult {
  textBody: string;
  htmlBody: string;
  attachments: ParsedAttachment[];
}

/** Recursively walk a (possibly multipart) MIME body, given its own header block. */
function extractBody(headers: Record<string, string>, body: string): BodyResult {
  const contentType = headers['content-type'] ?? 'text/plain';
  const boundary = contentType.match(/boundary="?([^"\s;]+)"?/i)?.[1];
  const encoding = (headers['content-transfer-encoding'] ?? '').toLowerCase();

  if (!(/multipart\//i.test(contentType) && boundary)) {
    if (/text\/html/i.test(contentType)) {
      return { textBody: '', htmlBody: decodeText(body, encoding), attachments: [] };
    }
    return { textBody: decodeText(body, encoding), htmlBody: '', attachments: [] };
  }

  let textBody = '';
  let htmlBody = '';
  const attachments: ParsedAttachment[] = [];

  for (const part of splitParts(body, boundary)) {
    const { headerBlock: pHead, body: pBody } = splitHeaderBody(part);
    const ph = parseHeaders(pHead);
    const pType = ph['content-type'] ?? 'text/plain';

    // Nested multipart (e.g. multipart/alternative wrapping text/plain +
    // text/html, sitting inside an outer multipart/mixed with attachments).
    if (/multipart\//i.test(pType)) {
      const nested = extractBody(ph, pBody);
      if (!textBody) textBody = nested.textBody;
      if (!htmlBody) htmlBody = nested.htmlBody;
      attachments.push(...nested.attachments);
      continue;
    }

    const disp = ph['content-disposition'] ?? '';
    const filename =
      disp.match(/filename="?([^"\r\n;]+)"?/i)?.[1] ?? pType.match(/name="?([^"\r\n;]+)"?/i)?.[1];
    const enc = (ph['content-transfer-encoding'] ?? '').toLowerCase();

    if (filename && (/attachment/i.test(disp) || /name=/i.test(pType))) {
      attachments.push({
        filename: filename.trim(),
        mime: (pType.split(';')[0] ?? 'application/octet-stream').trim(),
        content: decodeBinary(pBody, enc),
      });
    } else if (/text\/plain/i.test(pType) && !textBody) {
      textBody = decodeText(pBody, enc);
    } else if (/text\/html/i.test(pType) && !htmlBody) {
      htmlBody = decodeText(pBody, enc);
    }
  }

  return { textBody, htmlBody, attachments };
}

function splitHeaderBody(block: string): { headerBlock: string; body: string } {
  const m = block.match(/\r?\n\r?\n/);
  if (!m || m.index === undefined) return { headerBlock: block, body: '' };
  return { headerBlock: block.slice(0, m.index), body: block.slice(m.index + m[0].length) };
}

function parseHeaders(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  const lines = block.split(/\r?\n/);
  let currentKey = '';
  for (const line of lines) {
    if (/^\s/.test(line) && currentKey) {
      out[currentKey] += ' ' + line.trim();
      continue;
    }
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    currentKey = line.slice(0, idx).trim().toLowerCase();
    out[currentKey] = line.slice(idx + 1).trim();
  }
  return out;
}

function splitParts(body: string, boundary: string): string[] {
  const delim = `--${boundary}`;
  return body
    .split(delim)
    .map((p) => p.replace(/^\r?\n/, '').replace(/\r?\n$/, ''))
    .filter((p) => p && p !== '--' && !/^--\r?\n?$/.test(p));
}

/** Decode a text part per its Content-Transfer-Encoding; defaults to as-is (7bit/8bit/binary). */
function decodeText(body: string, encoding: string): string {
  const trimmed = body.trim();
  if (encoding === 'quoted-printable') return decodeQuotedPrintable(trimmed).trim();
  if (encoding === 'base64') return Buffer.from(trimmed.replace(/\s+/g, ''), 'base64').toString('utf8').trim();
  return trimmed;
}

/** Decode a binary (attachment) part per its Content-Transfer-Encoding. */
function decodeBinary(body: string, encoding: string): Buffer {
  const trimmed = body.trim();
  if (encoding === 'base64') return Buffer.from(trimmed.replace(/\s+/g, ''), 'base64');
  if (encoding === 'quoted-printable') return Buffer.from(decodeQuotedPrintable(trimmed), 'utf8');
  return Buffer.from(trimmed, 'utf8');
}

/**
 * Minimal quoted-printable decoder: soft line breaks + =XX hex escapes.
 * Collects raw bytes and decodes as UTF-8 once at the end, rather than
 * per-escape, so multi-byte UTF-8 sequences (e.g. =E2=82=B9 for ₹, or
 * =C2=A0 for a non-breaking space) reassemble correctly instead of mojibake.
 */
function decodeQuotedPrintable(s: string): string {
  const joined = s.replace(/=\r?\n/g, '');
  const bytes: number[] = [];
  for (let i = 0; i < joined.length; i++) {
    if (joined[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(joined.slice(i + 1, i + 3))) {
      bytes.push(parseInt(joined.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(joined.charCodeAt(i));
    }
  }
  return Buffer.from(bytes).toString('utf8');
}

/** Last-resort plain-text rendering of an HTML body when there's no text/plain part. */
function htmlToText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function cleanAddr(v: string | undefined): string | null {
  if (!v) return null;
  const angle = v.match(/<([^>]+)>/)?.[1];
  return (angle ?? v).trim() || null;
}

function stripAngles(v: string | undefined): string | null {
  if (!v) return null;
  return v.replace(/[<>]/g, '').trim() || null;
}
