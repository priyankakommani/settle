import type { DocumentCategoryValue } from '@settle/shared';
import type { ParsedEmail } from '../types.js';
import type { Extractor } from './types.js';
import { uberExtractor } from './uber.extractor.js';
import { makeMyTripFlightExtractor } from './makemytrip-flight.extractor.js';
import { hotelInvoiceExtractor } from './hotel-invoice.extractor.js';
import { restaurantBillExtractor } from './restaurant-bill.extractor.js';
import { advanceExtractor } from './advance.extractor.js';
import { approvalExtractor } from './approval.extractor.js';
import { genericExtractor } from './generic.extractor.js';

/**
 * Ordered — first extractor whose `canExtract` returns true wins.
 * `genericExtractor` always matches, so it MUST stay last: it's the
 * catch-all for documents that don't fit any known sender/format.
 */
export const extractors: Extractor[] = [
  approvalExtractor,
  advanceExtractor,
  makeMyTripFlightExtractor,
  hotelInvoiceExtractor,
  uberExtractor,
  restaurantBillExtractor,
  genericExtractor,
];

export function selectExtractor(email: ParsedEmail): Extractor | null {
  return extractors.find((e) => e.canExtract(email)) ?? null;
}

/** Pick an extractor by an already-decided document category (used for direct uploads). */
export function extractorForCategory(category: DocumentCategoryValue): Extractor | null {
  return extractors.find((e) => e.handles.includes(category)) ?? null;
}

/**
 * Run the sender/format-specific extractor first; if it matches but its
 * narrow format assumptions don't fit this particular document (returns no
 * items), retry with genericExtractor before giving up. Without this, a
 * document that trips a specific extractor's canExtract/category match but
 * doesn't fit its exact regex silently produces nothing — even when the
 * generic total/date/merchant scan would have caught it.
 */
export function extractWithFallback(
  extractor: Extractor | null,
  email: ParsedEmail,
  ocrText: string | undefined,
): { extractor: Extractor | null; items: ExtractedItemsResult } {
  if (!extractor) {
    if (!genericExtractor.canExtract(email)) return { extractor: null, items: [] };
    return { extractor: genericExtractor, items: genericExtractor.extract(email, ocrText) };
  }
  const items = extractor.extract(email, ocrText);
  if (items.length > 0 || extractor === genericExtractor) {
    return { extractor, items };
  }
  if (!genericExtractor.canExtract(email)) return { extractor, items };
  const fallbackItems = genericExtractor.extract(email, ocrText);
  return fallbackItems.length > 0
    ? { extractor: genericExtractor, items: fallbackItems }
    : { extractor, items };
}

type ExtractedItemsResult = ReturnType<Extractor['extract']>;
