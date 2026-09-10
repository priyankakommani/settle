import type { Extractor } from './types.js';

/**
 * Finance "travel advance credited" mail. Not a claim line — updates the
 * trip's advanceRef + advanceAmount. Emits no ExtractedItem.
 */
export const advanceExtractor: Extractor = {
  name: 'advance',
  handles: ['advance'],
  canExtract: (email) => /advance (credited|disbursed)/i.test(email.subject ?? ''),
  extract: () => [],
};
