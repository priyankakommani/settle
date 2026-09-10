import { ClaimCategory, PaidBy } from '@settle/shared';
import type { ExtractedItem } from '../types.js';
import type { Extractor } from './types.js';
import { amount, group } from './_parse.js';
import { looseDateToIsoDay } from '../../lib/dates.js';
import { round2, toNum } from '../../lib/num.js';

/**
 * Hotel tax invoice (folio). Emits ONE lodging line for room + room-tax and
 * SEPARATE lines for folio extras (laundry / mini bar / in-room dining) so the
 * policy engine can disallow them explicitly rather than dropping them
 * (policy 3.1, 4). Prefers the attached invoice (OCR text) over the covering
 * mail when both are present.
 */
export const hotelInvoiceExtractor: Extractor = {
  name: 'hotel-invoice',
  handles: ['hotel_invoice'],
  canExtract: (email) => /tax invoice|folio/i.test(email.subject ?? ''),
  extract: (email, ocrText): ExtractedItem[] => {
    const src = `${email.textBody ?? ''}\n${ocrText ?? ''}`;

    // Prefer the "Room charges" summary line; else sum the per-night "Room Charge" rows.
    const perNight = sum(src, /Room Charge\b\s+([\d,]+\.\d{2})/gi);
    const room =
      amount(src, /(?:^|\n)\s*Room charges\b\s+([\d,]+\.\d{2})/i) ??
      (perNight > 0 ? perNight : null) ??
      amount(src, /Room charges?\b\s+([\d,]+\.\d{2})/i);
    if (!room) return [];

    const folio = group(src, /(?:Folio\s*no\.?|Invoice\s*No\.?)\s*([A-Za-z0-9/\-]+)/i);
    const nights = Math.max(1, Math.round(toNum(group(src, /Nights?\s*:?\s*(\d+)/i) ?? '1')));
    const subTotal = amount(src, /Sub ?total\s+([\d,]+\.\d{2})/i) ?? room;
    const cgst = amount(src, /CGST[^\n]*?([\d,]+\.\d{2})/i) ?? 0;
    const sgst = amount(src, /SGST[^\n]*?([\d,]+\.\d{2})/i) ?? 0;
    const totalTax = round2(cgst + sgst);

    // Only the portion of GST attributable to the room tariff is reimbursable.
    const roomTax = subTotal > 0 ? round2(totalTax * (room / subTotal)) : totalTax;
    const checkoutIso =
      looseDateToIsoDay(group(src, /Check[- ]?out\s+(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})/i)) ??
      (email.date ? email.date.slice(0, 10) : null);

    const items: ExtractedItem[] = [
      {
        category: ClaimCategory.LODGING,
        merchant: 'Keys Prime Whitefield',
        lineDate: checkoutIso,
        grossAmount: round2(room + roomTax),
        taxAmount: roomTax,
        paidBy: PaidBy.EMPLOYEE,
        currency: 'INR',
        reference: folio,
        meta: { folio, nights, tariffPerNight: round2(room / nights), roomTax },
      },
    ];

    const EXTRAS: [string, RegExp][] = [
      ['Laundry', /Laundry\s+([\d,]+\.\d{2})/i],
      ['Mini bar', /Mini ?bar\s+([\d,]+\.\d{2})/i],
      ['In-room dining', /In[- ]?room dining\s+([\d,]+\.\d{2})/i],
    ];
    for (const [kind, re] of EXTRAS) {
      const amt = amount(src, re);
      if (amt && amt > 0) {
        items.push({
          category: ClaimCategory.OTHER,
          merchant: 'Keys Prime Whitefield',
          lineDate: checkoutIso,
          grossAmount: amt,
          taxAmount: 0,
          paidBy: PaidBy.EMPLOYEE,
          currency: 'INR',
          reference: folio ? `${folio}:${kind}` : null,
          meta: { folio, kind, nonReimbursable: true },
        });
      }
    }

    return items;
  },
};

function sum(text: string, re: RegExp): number {
  return round2([...text.matchAll(re)].reduce((a, m) => a + toNum(m[1]), 0));
}
