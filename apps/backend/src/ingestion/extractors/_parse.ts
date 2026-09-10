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
