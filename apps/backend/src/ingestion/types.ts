import type { ClaimCategoryValue, DocumentCategoryValue, PaidByValue } from '@settle/shared';

/** Output of the mail parser — a normalised view of one .eml. */
export interface ParsedEmail {
  from: string | null;
  to: string[];
  subject: string | null;
  date: string | null;
  messageId: string | null;
  inReplyTo: string | null;
  textBody: string;
  attachments: ParsedAttachment[];
}

export interface ParsedAttachment {
  filename: string;
  mime: string;
  content: Buffer;
}

/** Output of the classifier for one document. */
export interface Classification {
  category: DocumentCategoryValue;
  confidence: number; // 0..1
  isNoise: boolean;
}

/** A structured expense pulled out of a document by an extractor. */
export interface ExtractedItem {
  category: ClaimCategoryValue;
  merchant: string | null;
  lineDate: string | null; // ISO date
  grossAmount: number;
  taxAmount: number;
  paidBy: PaidByValue;
  currency: string;
  /** bill no / folio / PNR / anything usable for dedup + proof */
  reference: string | null;
  meta?: Record<string, unknown>;
}
