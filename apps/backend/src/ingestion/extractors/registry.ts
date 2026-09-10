import type { DocumentCategoryValue } from '@settle/shared';
import type { ParsedEmail } from '../types.js';
import type { Extractor } from './types.js';
import { uberExtractor } from './uber.extractor.js';
import { makeMyTripFlightExtractor } from './makemytrip-flight.extractor.js';
import { hotelInvoiceExtractor } from './hotel-invoice.extractor.js';
import { restaurantBillExtractor } from './restaurant-bill.extractor.js';
import { advanceExtractor } from './advance.extractor.js';
import { approvalExtractor } from './approval.extractor.js';

/** Ordered — first extractor whose `canExtract` returns true wins. */
export const extractors: Extractor[] = [
  approvalExtractor,
  advanceExtractor,
  makeMyTripFlightExtractor,
  hotelInvoiceExtractor,
  uberExtractor,
  restaurantBillExtractor,
];

export function selectExtractor(email: ParsedEmail): Extractor | null {
  return extractors.find((e) => e.canExtract(email)) ?? null;
}

/** Pick an extractor by an already-decided document category (used for direct uploads). */
export function extractorForCategory(category: DocumentCategoryValue): Extractor | null {
  return extractors.find((e) => e.handles.includes(category)) ?? null;
}
