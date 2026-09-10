import { ClaimCategory, PaidBy } from '@settle/shared';
import type { ExtractedItem } from '../types.js';
import type { Extractor } from './types.js';
import { amount, group } from './_parse.js';
import { looseDateToIsoDay } from '../../lib/dates.js';

/**
 * Uber ride receipts (noreply@uber.com) and forwarded copies of them. One
 * conveyance line per ride. The rider name is captured so the pipeline can
 * flag rides taken by someone other than the claimant (policy 4).
 */
export const uberExtractor: Extractor = {
  name: 'uber',
  handles: ['cab'],
  canExtract: (email) =>
    (email.from ?? '').includes('uber.com') || /trip with uber/i.test(email.subject ?? ''),
  extract: (email): ExtractedItem[] => {
    const body = email.textBody ?? '';
    const total =
      amount(body, /Total\s+INR\s+([\d,]+\.\d{2})/i) ??
      amount(body, /Amount due\s+INR\s+([\d,]+\.\d{2})/i);
    if (total === null) return [];

    const tax = amount(body, /Taxes?\s+([\d,]+\.\d{2})/i) ?? 0;
    const rider = group(body, /Thanks for riding,\s*([A-Za-z][A-Za-z .'-]*)/i);
    const pickup = group(body, /Pickup\s+(.+)/i);
    const drop = group(body, /Drop\s+(.+)/i);
    const dateStr = group(body, /(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})/);
    const lineDate = looseDateToIsoDay(dateStr) ?? (email.date ? email.date.slice(0, 10) : null);
    const airportTransfer = /airport|PNQ|BLR|MAA|international airport/i.test(`${pickup ?? ''} ${drop ?? ''}`);

    return [
      {
        category: ClaimCategory.CONVEYANCE,
        merchant: 'Uber',
        lineDate,
        grossAmount: total,
        taxAmount: tax,
        paidBy: PaidBy.EMPLOYEE,
        currency: 'INR',
        reference: null,
        meta: { rider, pickup, drop, airportTransfer },
      },
    ];
  },
};
