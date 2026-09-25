/**
 * Deterministic "OCR" for the sample receipt images.
 *
 * Real OCR of arbitrary photographed bills is too unreliable to compute a
 * settlement on, so the demo receipts are transcribed up front.
 * Instead we transcribe the two known receipt images once, keyed by filename.
 * Any other image attachment gets `ocrStatus: 'skipped'` and its line lands as
 * `needs_info` for the claimant to complete — the pipeline still runs.
 */
export const KNOWN_RECEIPT_TEXT: Record<string, string> = {
  'dinner_bill_18jun.png': [
    'SPICE TERRACE',
    'Whitefield, Bengaluru 560066',
    'GSTIN 29AAFCS1188K1ZP',
    'Bill No 4471   Table 12   Covers 4',
    '18-Jun-2026   21:38',
    '2 x Paneer Tikka        760.00',
    '1 x Andhra Chicken      420.00',
    '4 x Butter Naan         320.00',
    '1 x Dal Makhani         310.00',
    '2 x Fresh Lime Soda     240.00',
    'Sub Total              2,050.00',
    'CGST 2.5%                 51.25',
    'SGST 2.5%                 51.25',
    'Service Charge 5%        102.50',
    'TOTAL                  2,255.00',
    'Paid by CARD ****2288',
  ].join('\n'),

  'hotel_invoice_1188.png': [
    'KEYS PRIME WHITEFIELD',
    'Tax Invoice',
    'Invoice No KPW/26-27/1188',
    'GSTIN 29AACCK7712M1Z4',
    'Guest   : Chaitanya Reddy',
    'Company : Acme Corp',
    'Check In  16-Jun-2026 14:10',
    'Check Out 19-Jun-2026 11:05',
    'Nights: 3   Room: 412 Superior King',
    '16-Jun  Room Charge   5,750.00',
    '17-Jun  Room Charge   5,750.00',
    '17-Jun  Laundry         450.00',
    '18-Jun  Room Charge   5,750.00',
    '18-Jun  Mini Bar        380.00',
    '18-Jun  In Room Dining 1,120.00',
    'Room charges          17,250.00',
    'Laundry                 450.00',
    'Mini bar                380.00',
    'In-room dining        1,120.00',
    'Sub Total            19,200.00',
    'CGST 6%               1,152.00',
    'SGST 6%               1,152.00',
    'Invoice Total        21,504.00',
    'Settled by Guest  CARD ****2288',
  ].join('\n'),
};
