import type { ClaimLine, TripDocument } from '../../api/types.js';

export interface DocStatus {
  tone: 'ok' | 'warn' | 'info' | 'neutral';
  label: string;
  detail: string;
}

const CATEGORY_NAME: Record<string, string> = {
  cab: 'a cab receipt',
  hotel_invoice: 'a hotel invoice',
  flight: 'a flight booking',
  meal: 'a meal receipt',
  business_entertainment: 'a business entertainment bill',
};

/** Why nothing could be extracted, using whatever signal is on hand (category, OCR status of any attachment). */
function noLineDetail(doc: TripDocument): string {
  const att = doc.attachments[0];
  if (att) {
    if (att.ocrStatus === 'failed') {
      return "The attached image couldn't be read (OCR failed) — try re-uploading a clearer photo, or enter this expense manually.";
    }
    if (att.ocrStatus === 'skipped') {
      return "This file type isn't supported for automatic reading yet — enter this expense manually.";
    }
    // ocrStatus 'done': the text was read fine, so the miss is in extraction, not OCR.
    const known = CATEGORY_NAME[doc.category];
    return known
      ? `Recognised as ${known}, but the text didn't match the expected amount/total pattern — check the attachment preview below to see what was actually read, then add the expense manually.`
      : "The attachment was read, but no recognisable amount was found in the text — check the attachment preview below, then add the expense manually.";
  }
  const known = CATEGORY_NAME[doc.category];
  if (known) {
    return `Recognised as ${known}, but no valid amount/date could be parsed from the message text — it may be a duplicate or forward of an expense already on this claim, or a format not supported yet.`;
  }
  return "This document wasn't recognised as any known receipt, booking, or approval format, so nothing could be extracted automatically — check the content below, then add the expense manually if it's a real one.";
}

/** A clear, honest explanation of what happened to this document — for both the uploader and whoever reviews it later. */
export function deriveDocStatus(doc: TripDocument, claimLines: ClaimLine[], allDocs: TripDocument[]): DocStatus {
  if (doc.isDuplicateOf) {
    const original = allDocs.find((d) => d.id === doc.isDuplicateOf);
    return {
      tone: 'neutral',
      label: 'Duplicate',
      detail: original
        ? `Matches an expense already captured from "${original.subject ?? 'another document'}" — not double-counted.`
        : 'Matches an expense already captured from another document — not double-counted.',
    };
  }
  if (doc.isNoise) {
    return {
      tone: 'neutral',
      label: 'Ignored',
      detail: 'Classified as promotional mail or a failed-payment notice — not a real expense or trip event.',
    };
  }
  const produced = claimLines.filter((l) => l.sourceDocumentId === doc.id);
  if (produced.length > 0) {
    const count = produced.length;
    const s = count > 1 ? 's' : '';
    // Producing a line isn't the same as clearing it — a line can still come back
    // capped, disallowed, or needing info. Say so here instead of a blanket "ok".
    const notCleared = produced.filter((l) => l.policyVerdict !== 'allowed');
    if (notCleared.length > 0) {
      const verdicts = [...new Set(notCleared.map((l) => l.policyVerdict ?? 'needs_info'))];
      return {
        tone: 'warn',
        label: `${count} claim line${s} · not cleared`,
        detail: `Produced ${count} claim line${s} from this document, but ${notCleared.length === count ? (count > 1 ? 'none were' : "it wasn't") : `${notCleared.length} of them ${notCleared.length > 1 ? "weren't" : "wasn't"}`} fully cleared by policy (${verdicts.join(', ')}) — see Claim Lines for the reason.`,
      };
    }
    return {
      tone: 'ok',
      label: `${count} claim line${s}`,
      detail: `Automatically produced ${count} claim line${s} from this document.`,
    };
  }
  switch (doc.category) {
    case 'travel_approval':
      return {
        tone: 'info',
        label: 'Trip context',
        detail: "Used to fill in the trip's dates/destination/approver — not a claim line by itself.",
      };
    case 'advance':
      return {
        tone: 'info',
        label: 'Advance applied',
        detail: "Updated the trip's advance amount/reference — not a claim line by itself.",
      };
    case 'hotel_booking':
      return {
        tone: 'info',
        label: 'Booking only',
        detail: 'A "pay at hotel" confirmation, not proof of payment — the hotel\'s tax invoice produces the actual lodging line.',
      };
    default:
      return {
        tone: 'warn',
        label: 'No claim line',
        detail: noLineDetail(doc),
      };
  }
}
