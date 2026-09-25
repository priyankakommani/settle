import { looseDateToIsoDay } from '../../lib/dates.js';
import { round2, toNum } from '../../lib/num.js';

/** First capture group of `re` in `text`, parsed as money; null if no match. */
export function amount(text: string, re: RegExp): number | null {
  const m = text.match(re);
  if (!m) return null;
  const n = toNum(m[1]);
  return Number.isFinite(n) ? round2(n) : null;
}

/** All amounts captured by a /g regex. */
export function amounts(text: string, re: RegExp): number[] {
  return [...text.matchAll(re)].map((m) => round2(toNum(m[1])));
}

/** First loose date found anywhere in the text -> 'YYYY-MM-DD', or null. */
export function firstDate(text: string): string | null {
  const m = text.match(/\d{4}-\d{2}-\d{2}|\d{1,2}[-\s][A-Za-z]{3}[a-z]*[-\s]\d{4}/);
  return m ? looseDateToIsoDay(m[0]) : null;
}

/** First capture group of `re`, trimmed; null if no match. */
export function group(text: string, re: RegExp): string | null {
  return text.match(re)?.[1]?.trim() ?? null;
}

/**
 * Guess the currency from whatever symbol/code sits near the amounts.
 * Defaults to INR — every sample document is India-only, so an
 * unrecognized/absent symbol is far more likely a formatting miss than a
 * genuine foreign-currency receipt.
 */
export function detectCurrency(text: string): string {
  if (/₹|\brs\.?\b|\binr\b/i.test(text)) return 'INR';
  if (/\$|\busd\b/i.test(text)) return 'USD';
  if (/€|\beur\b/i.test(text)) return 'EUR';
  if (/£|\bgbp\b/i.test(text)) return 'GBP';
  return 'INR';
}

/** First non-blank line of `text`, trimmed; null if none. */
export function firstNonBlankLine(text: string | undefined | null): string | null {
  return text?.split('\n').map((l) => l.trim()).find(Boolean) ?? null;
}

/**
 * First line that reads like an actual merchant/heading, skipping OCR noise —
 * e.g. a photographed screenshot's browser chrome ("...&msg=%23msg-f%3A18300...")
 * gets picked up as "line 1" by Tesseract above the real content. Falls back
 * to the first non-blank line if nothing looks plausible.
 */
export function firstPlausibleLine(text: string | undefined | null): string | null {
  const lines = (text ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  const plausible = lines.find((l) => {
    if (/[=&].*[=&]/.test(l)) return false; // URL query-string-shaped noise
    const letters = l.match(/[A-Za-z]/g)?.length ?? 0;
    return letters >= 3 && letters / l.length > 0.5;
  });
  return plausible ?? lines[0] ?? null;
}
