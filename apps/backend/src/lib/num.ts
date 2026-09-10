/** Money helpers. All amounts are INR with 2 decimals; DB columns are numeric(14,2). */

/** Round to 2 decimals, killing FP noise (0.1 + 0.2 style). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Parse a numeric DB value / user string into a number; NaN -> 0. */
export function toNum(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    const n = Number(v.replace(/,/g, '').trim());
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/** Format a number for a numeric(14,2) column. */
export function money(n: number): string {
  return round2(n).toFixed(2);
}
