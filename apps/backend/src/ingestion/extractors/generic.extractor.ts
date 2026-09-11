import { ClaimCategory, DocumentCategory, PaidBy } from '@settle/shared';
import type { ClaimCategoryValue } from '@settle/shared';
import type { ExtractedItem, ParsedEmail } from '../types.js';
import type { Extractor } from './types.js';
import { amount, amounts, detectCurrency, firstDate, firstPlausibleLine } from './_parse.js';
import { classify } from '../classifier.js';
import { round2 } from '../../lib/num.js';

/**
 * Categories deliberately excluded from the generic fallback because "no
 * extractor" is how the pipeline already represents them correctly:
 *  - NOISE / ADVANCE / TRAVEL_APPROVAL: not claimable lines at all.
 *  - HOTEL_BOOKING: a "Pay at Hotel" confirmation, not proof of payment — the
 *    real invoice (hotel_invoice) produces the actual lodging line, and
 *    extracting from the voucher too would double it.
 *  - FLIGHT: corporate-booked and billed to the company card (policy 3.2);
 *    a blind fallback marking it paidBy=Employee would wrongly let it be
 *    claimed. An unrecognized flight format should stay a no-extractor case.
 */
const EXCLUDED_CATEGORIES: string[] = [
  DocumentCategory.NOISE,
  DocumentCategory.ADVANCE,
  DocumentCategory.TRAVEL_APPROVAL,
  DocumentCategory.HOTEL_BOOKING,
  DocumentCategory.FLIGHT,
];

/**
 * Last-resort catch-all, tried after every sender-specific extractor. Scans
 * generically for a total amount / date / merchant so a document in an
 * unrecognized format still produces a claim line (flagged for review)
 * instead of silently disappearing. Always registered last in registry.ts so
 * specific extractors get first refusal.
 */
export const genericExtractor: Extractor = {
  name: 'generic',
  handles: [
    DocumentCategory.UNKNOWN,
    DocumentCategory.MEAL,
    DocumentCategory.BUSINESS_ENTERTAINMENT,
    DocumentCategory.CAB,
    DocumentCategory.HOTEL_INVOICE,
  ],
  canExtract: (email) => !EXCLUDED_CATEGORIES.includes(classify(email).category),
  extract: (email, ocrText): ExtractedItem[] => {
    const src = `${email.textBody ?? ''}\n${ocrText ?? ''}`;

    let total =
      amount(src, /(?:^|\n)[ \t]*(?:grand\s+|invoice\s+|bill\s+)?total\b[^\n\d]{0,25}([\d,]+\.\d{2})/i) ??
      amount(src, /amount\s+(?:due|payable|charged|paid)\b[^\n\d]{0,25}([\d,]+\.\d{2})/i) ??
      amount(src, /(?:inr|rs\.?|₹|\$|usd)\s*([\d,]+\.\d{2})/i);

    // No explicit "total" line found (e.g. OCR dropped a stylized total
    // heading) — fall back to the largest currency-looking amount in the
    // text rather than losing the receipt to a blank placeholder. Flagged
    // low-confidence via meta.approximateTotal below.
    let approximate = false;
    if (total === null) {
      const all = amounts(src, /(?:inr|rs\.?|₹|\$|usd|€|eur|£|gbp)\s*([\d,]+\.\d{2})/gi);
      if (all.length > 0) {
        total = Math.max(...all);
        approximate = true;
      }
    }
    if (total === null) return [];

    const cgst = amount(src, /CGST[^\n]*?([\d,]+\.\d{2})/i) ?? 0;
    const sgst = amount(src, /SGST[^\n]*?([\d,]+\.\d{2})/i) ?? 0;
    const gst = cgst || sgst ? 0 : amount(src, /\bGST\b[^\n]*?([\d,]+\.\d{2})/i) ?? 0;
    const taxAmount = round2(cgst + sgst + gst);

    const merchant =
      firstPlausibleLine(ocrText) ?? (email.subject?.trim() || null) ?? 'Unrecognized merchant';
    const lineDate = firstDate(src) ?? (email.date ? email.date.slice(0, 10) : null);

    return [
      {
        category: guessCategory(email),
        merchant: merchant.slice(0, 120),
        lineDate,
        grossAmount: total,
        taxAmount,
        paidBy: PaidBy.EMPLOYEE,
        currency: detectCurrency(src),
        reference: null,
        meta: {
          autoExtracted: true,
          needsInfo: true,
          source: 'generic-extractor',
          ...(approximate ? { approximateTotal: true } : {}),
        },
      },
    ];
  },
};

function guessCategory(email: ParsedEmail): ClaimCategoryValue {
  const cls = classify(email);
  switch (cls.category) {
    case DocumentCategory.HOTEL_INVOICE:
      return ClaimCategory.LODGING;
    case DocumentCategory.CAB:
      return ClaimCategory.CONVEYANCE;
    case DocumentCategory.MEAL:
      return ClaimCategory.MEAL;
    case DocumentCategory.BUSINESS_ENTERTAINMENT:
      return ClaimCategory.BUSINESS_ENTERTAINMENT;
    default:
      return ClaimCategory.OTHER;
  }
}
