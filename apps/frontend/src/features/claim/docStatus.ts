import type { ClaimLine, TripDocument } from '../../api/types.js';

export interface DocStatus {
  tone: 'ok' | 'warn' | 'info' | 'neutral';
  label: string;
  detail: string;
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
    return {
      tone: 'ok',
      label: `${produced.length} claim line${produced.length > 1 ? 's' : ''}`,
      detail: `Automatically produced ${produced.length} claim line${produced.length > 1 ? 's' : ''} from this document.`,
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
        detail: "Couldn't automatically read an amount/category from this document — check the attachment preview below, then add the expense manually.",
      };
  }
}
