import { DocumentCategory } from '@settle/shared';
import type { Classification, ParsedEmail } from './types.js';

/**
 * Rule-based classifier: ordered (sender + subject/body keyword) -> category,
 * with a confidence. Promo / unsubscribe / "payment failed" -> noise.
 * Low confidence is a UI "needs review" hint, not a hard filter.
 */
export function classify(email: ParsedEmail): Classification {
  const from = (email.from ?? '').toLowerCase();
  const subject = (email.subject ?? '').toLowerCase();
  const body = (email.textBody ?? '').toLowerCase();

  // --- noise first -------------------------------------------------
  // Promo: judged on sender + subject only. A legit receipt can carry a
  // promo footer ("20% off your next ride"), so the body is not scanned here.
  if (
    from.includes('offers@') ||
    from.includes('newsletter@') ||
    /\bflat \d+%|\d+%\s*off\b|monsoon sale|use code \w+|% off on your next/i.test(subject)
  ) {
    return { category: DocumentCategory.NOISE, confidence: 0.96, isNoise: true };
  }
  if (/payment failed|could not charge|update your payment method/i.test(subject)) {
    return { category: DocumentCategory.NOISE, confidence: 0.9, isNoise: true };
  }

  // --- signal ------------------------------------------------------
  if (from.includes('makemytrip.com') && /e-?ticket|flight booking|flight/i.test(subject)) {
    return { category: DocumentCategory.FLIGHT, confidence: 0.95, isNoise: false };
  }
  if (from.includes('makemytrip.com') && /hotel|voucher/i.test(subject)) {
    return { category: DocumentCategory.HOTEL_BOOKING, confidence: 0.9, isNoise: false };
  }
  if (/tax invoice|folio/i.test(subject)) {
    return { category: DocumentCategory.HOTEL_INVOICE, confidence: 0.92, isNoise: false };
  }
  if (from.includes('uber.com') || /trip with uber|uber receipt/i.test(subject)) {
    return {
      category: DocumentCategory.CAB,
      confidence: from.includes('uber.com') ? 0.95 : 0.6,
      isNoise: false,
    };
  }
  if (/travel approval/i.test(subject)) {
    return { category: DocumentCategory.TRAVEL_APPROVAL, confidence: 0.9, isNoise: false };
  }
  if (/travel advance|advance (credited|disbursed)/i.test(subject)) {
    return { category: DocumentCategory.ADVANCE, confidence: 0.95, isNoise: false };
  }
  if (
    email.attachments.some((a) => a.mime.startsWith('image/')) &&
    /dinner|lunch|meal|bill|restaurant|hosted/i.test(`${subject}\n${body}`)
  ) {
    const be = /team|client|customer|guest|procurement|partner|vertex/i.test(body);
    return {
      category: be ? DocumentCategory.BUSINESS_ENTERTAINMENT : DocumentCategory.MEAL,
      confidence: 0.7,
      isNoise: false,
    };
  }

  return { category: DocumentCategory.UNKNOWN, confidence: 0.3, isNoise: false };
}

/**
 * Classify a directly-uploaded receipt (image / PDF) from its filename + OCR
 * text, when there is no email envelope to go on.
 */
export function classifyDocumentText(text: string, filename: string): Classification {
  const hay = `${filename}\n${text}`.toLowerCase();

  if (/tax invoice|folio|room charge|room tariff|check[- ]?out/.test(hay)) {
    return { category: DocumentCategory.HOTEL_INVOICE, confidence: 0.82, isNoise: false };
  }
  if (/restaurant|dinner|lunch|\bbill no\b|covers \d|table \d|sub ?total/.test(hay)) {
    const be = /team|client|customer|guest|procurement|partner|hosted/.test(hay);
    return {
      category: be ? DocumentCategory.BUSINESS_ENTERTAINMENT : DocumentCategory.MEAL,
      confidence: 0.68,
      isNoise: false,
    };
  }
  if (/\buber\b|trip fare|ride with|airport surcharge/.test(hay)) {
    return { category: DocumentCategory.CAB, confidence: 0.66, isNoise: false };
  }
  if (/e-?ticket|\bpnr\b|boarding pass|base fare/.test(hay)) {
    return { category: DocumentCategory.FLIGHT, confidence: 0.66, isNoise: false };
  }
  return { category: DocumentCategory.UNKNOWN, confidence: 0.3, isNoise: false };
}
