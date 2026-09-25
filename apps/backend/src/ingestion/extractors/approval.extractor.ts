import type { Extractor } from './types.js';

/**
 * Travel approval request/grant thread. Not a claim line — seeds the trip
 * (dates, destination, estimated spend, advance requested, approver).
 * Emits no ExtractedItem.
 */
export const approvalExtractor: Extractor = {
  name: 'travel-approval',
  handles: ['travel_approval'],
  canExtract: (email) => /travel approval/i.test(email.subject ?? ''),
  extract: () => [],
};
