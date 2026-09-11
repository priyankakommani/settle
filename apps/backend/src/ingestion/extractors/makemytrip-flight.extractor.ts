import { ClaimCategory, PaidBy } from '@settle/shared';
import type { ExtractedItem } from '../types.js';
import type { Extractor } from './types.js';
import { amounts, detectCurrency, firstDate, group } from './_parse.js';
import { round2 } from '../../lib/num.js';

/**
 * MakeMyTrip flight e-tickets. Flights are booked centrally and billed to the
 * company corporate card (policy 3.2) -> emitted as paidBy = 'Company', a memo
 * line the employee does not claim. One line covering all legs on the ticket.
 */
export const makeMyTripFlightExtractor: Extractor = {
  name: 'makemytrip-flight',
  handles: ['flight'],
  canExtract: (email) =>
    (email.from ?? '').includes('makemytrip.com') &&
    /e-?ticket|flight/i.test(email.subject ?? ''),
  extract: (email): ExtractedItem[] => {
    const body = email.textBody ?? '';
    // Tolerate any currency symbol/text between "Total" and the figure.
    const legTotals = amounts(body, /Total\b[^\n\d]{0,20}([\d,]+\.\d{2})/gi);
    const grand = round2(legTotals.reduce((a, b) => a + b, 0));
    if (grand === 0) return [];

    const pnr = group(body, /PNR:?\s*([A-Z0-9]{5,7})/);
    const route = group(body, /([A-Za-z]+\s*-\s*[A-Za-z]+)\s*\|/);
    // Airline name sits just before its flight-number code, e.g. "IndiGo 6E-6284".
    const airline = group(body, /\n\s*([A-Za-z][A-Za-z ]{1,25}?)\s+[0-9]?[A-Za-z]{1,2}-\d{3,4}\b/);
    const merchant = `${airline ?? 'Airline'} (via MakeMyTrip)`;

    return [
      {
        category: ClaimCategory.OTHER,
        merchant,
        lineDate: firstDate(body) ?? (email.date ? email.date.slice(0, 10) : null),
        grossAmount: grand,
        taxAmount: 0,
        paidBy: PaidBy.COMPANY,
        currency: detectCurrency(body),
        reference: pnr,
        meta: { pnr, route, legs: legTotals, note: 'Corporate card — billed to the company, not claimed (policy 3.2).' },
      },
    ];
  },
};
