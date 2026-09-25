import type { DocumentCategoryValue } from '@settle/shared';
import type { ExtractedItem, ParsedEmail } from '../types.js';

/**
 * One extractor per known sender/format. Keep each one dumb and specific —
 * plain string/regex parsing of its own layout only. Unknown formats fall
 * through to manual entry.
 */
export interface Extractor {
  name: string;
  /** which document categories this extractor can handle */
  handles: DocumentCategoryValue[];
  /** cheap check before running the (possibly heavier) extract */
  canExtract(email: ParsedEmail): boolean;
  extract(email: ParsedEmail, ocrText?: string): ExtractedItem[];
}
