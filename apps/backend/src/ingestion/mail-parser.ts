import { rfc2822ToIso } from '../lib/dates.js';
import type { ParsedAttachment, ParsedEmail } from './types.js';

/**
 * Parse a raw .eml buffer into `ParsedEmail`: headers, the first text/plain
 * part, and any attachments. A small hand-rolled MIME reader — no mail service,
 * no dependency. Good enough for the well-formed messages in the pack.
 */
export function parseEmail(raw: Buffer): ParsedEmail {
  const text = raw.toString('utf8');
  const { headerBlock, body } = splitHeaderBody(text);
  const headers = parseHeaders(headerBlock);

  const contentType = headers['content-type'] ?? 'text/plain';
  const boundary = contentType.match(/boundary="?([^"\s;]+)"?/i)?.[1];

  let textBody = '';
  const attachments: ParsedAttachment[] = [];

  if (/multipart\//i.test(contentType) && boundary) {
    for (const part of splitParts(body, boundary)) {
      const { headerBlock: pHead, body: pBody } = splitHeaderBody(part);
      const ph = parseHeaders(pHead);
      const pType = ph['content-type'] ?? 'text/plain';
      const disp = ph['content-disposition'] ?? '';
      const filename =
        disp.match(/filename="?([^"\r\n;]+)"?/i)?.[1] ?? pType.match(/name="?([^"\r\n;]+)"?/i)?.[1];

      if (filename && (/attachment/i.test(disp) || /name=/i.test(pType))) {
        const enc = (ph['content-transfer-encoding'] ?? '').toLowerCase();
        const trimmed = pBody.trim();
        const content =
          enc === 'base64' ? Buffer.from(trimmed.replace(/\s+/g, ''), 'base64') : Buffer.from(trimmed, 'utf8');
        attachments.push({
          filename: filename.trim(),
          mime: (pType.split(';')[0] ?? 'application/octet-stream').trim(),
          content,
        });
      } else if (/text\/plain/i.test(pType) && !textBody) {
        textBody = pBody.trim();
      }
    }
  } else {
    textBody = body.trim();
  }

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
    textBody,
    attachments,
  };
}

/* ------------------------------------------------------------------ */

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

function cleanAddr(v: string | undefined): string | null {
  if (!v) return null;
  const angle = v.match(/<([^>]+)>/)?.[1];
  return (angle ?? v).trim() || null;
}

function stripAngles(v: string | undefined): string | null {
  if (!v) return null;
  return v.replace(/[<>]/g, '').trim() || null;
}
