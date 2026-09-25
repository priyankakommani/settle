/** Small date utilities. The app works in whole calendar days, UTC. */

const MS_PER_DAY = 86_400_000;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** 'YYYY-MM-DD' for a Date (UTC). */
export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Parse an RFC-2822 header date ("Mon, 08 Jun 2026 11:12:04 +0530") to ISO, or null. */
export function rfc2822ToIso(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/**
 * Parse loose date shapes seen in receipts/emails into 'YYYY-MM-DD':
 *   "18-Jun-2026", "18 Jun 2026", "16 Jun 2026 | 05:20 AM", "2026-06-18"
 */
export function looseDateToIsoDay(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  const iso = s.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = s.match(/\b(\d{1,2})[-\s]([A-Za-z]{3})[a-z]*[-\s](\d{4})\b/);
  if (dmy) {
    const mi = MONTHS.indexOf(dmy[2]!.toLowerCase());
    if (mi >= 0) {
      return `${dmy[3]}-${String(mi + 1).padStart(2, '0')}-${dmy[1]!.padStart(2, '0')}`;
    }
  }
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}

/** Inclusive whole-day span between two 'YYYY-MM-DD' strings; null unless both parse. */
export function inclusiveDays(start?: string | null, end?: string | null): number | null {
  if (!start || !end) return null;
  const a = Date.parse(`${start}T00:00:00Z`);
  const b = Date.parse(`${end}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null;
  return Math.round((b - a) / MS_PER_DAY) + 1;
}

/** Whole calendar days from a 'YYYY-MM-DD' to now (UTC); negative if in the future. */
export function daysSince(day: string | null | undefined, now = new Date()): number | null {
  if (!day) return null;
  const t = Date.parse(`${day}T00:00:00Z`);
  if (Number.isNaN(t)) return null;
  const today = Date.parse(`${isoDay(now)}T00:00:00Z`);
  return Math.round((today - t) / MS_PER_DAY);
}

/**
 * Finance runs payments on the 10th and 25th (policy 5.4). Returns the next
 * such date on or after `from` as 'YYYY-MM-DD'.
 */
export function nextPaymentRun(from = new Date()): string {
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth();
  const d = from.getUTCDate();
  if (d <= 10) return isoDay(new Date(Date.UTC(y, m, 10)));
  if (d <= 25) return isoDay(new Date(Date.UTC(y, m, 25)));
  return isoDay(new Date(Date.UTC(y, m + 1, 10)));
}
