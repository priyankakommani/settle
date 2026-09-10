import { round2 } from '../lib/num.js';
import type { ExtractedItem } from './types.js';

export interface DedupResult {
  kept: ExtractedItem[];
  duplicates: { item: ExtractedItem; duplicateOfReference: string | null }[];
}

/**
 * PURE. Collapse resends / forwards. Primary match key is
 * (category, merchant, lineDate, grossAmount); `reference` is an extra
 * confirmation, not a differentiator — a "Fwd:" / resend of an already-seen
 * expense carries a new Message-ID but the same triple, and is a duplicate.
 * Payment-failed entries are dropped upstream by the classifier.
 */
export function dedupe(items: ExtractedItem[]): DedupResult {
  const kept: ExtractedItem[] = [];
  const duplicates: DedupResult['duplicates'] = [];
  const seenByKey = new Map<string, ExtractedItem>();
  const seenByRef = new Map<string, ExtractedItem>();

  for (const item of items) {
    const key = [
      item.category,
      (item.merchant ?? '').toLowerCase().trim(),
      item.lineDate ?? '',
      round2(item.grossAmount).toFixed(2),
    ].join('|');
    const refKey = item.reference ? `${item.category}|${item.reference}` : null;

    const prior = seenByKey.get(key) ?? (refKey ? seenByRef.get(refKey) : undefined);
    if (prior) {
      duplicates.push({ item, duplicateOfReference: prior.reference ?? prior.merchant ?? null });
      continue;
    }

    seenByKey.set(key, item);
    if (refKey) seenByRef.set(refKey, item);
    kept.push(item);
  }

  return { kept, duplicates };
}
