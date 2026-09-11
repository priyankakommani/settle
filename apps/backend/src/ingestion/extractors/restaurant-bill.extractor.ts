import { ClaimCategory, PaidBy } from '@settle/shared';
import type { ExtractedItem } from '../types.js';
import type { Extractor } from './types.js';
import { amount, detectCurrency, firstNonBlankLine, group } from './_parse.js';
import { looseDateToIsoDay } from '../../lib/dates.js';
import { toNum } from '../../lib/num.js';

/**
 * Restaurant bill (image attachment, self-mailed). Business entertainment when
 * the covering note names guests / an organisation; otherwise a plain meal.
 * Attendee names + HOD pre-approval are almost never in the mail — the policy
 * engine will mark the line `needs_info` and the claimant fills the gap.
 */
export const restaurantBillExtractor: Extractor = {
  name: 'restaurant-bill',
  handles: ['meal', 'business_entertainment'],
  canExtract: (email) => email.attachments.some((a) => a.mime.startsWith('image/')),
  extract: (email, ocrText): ExtractedItem[] => {
    const note = email.textBody ?? '';
    const src = ocrText ?? note;

    // Anchor to line start and exclude "Sub Total" so we take the grand total.
    // Tolerate any currency symbol/text (INR, Rs, $, ₹, ...) between the label
    // and the figure instead of requiring the literal word "INR".
    const total =
      amount(src, /(?:^|\n)[ \t]*(?:grand )?total\b[^\n\d]{0,20}([\d,]+\.\d{2})/i) ??
      amount(src, /(?:^|\n)[ \t]*amount payable\b[^\n\d]{0,20}([\d,]+\.\d{2})/i);
    if (total === null) return [];

    const merchant = (firstNonBlankLine(ocrText) ?? 'Restaurant').slice(0, 120);
    const billNo = group(src, /Bill No\.?\s*([A-Za-z0-9-]+)/i);
    const lineDate =
      looseDateToIsoDay(group(src, /(\d{1,2}[-\s][A-Za-z]{3}[a-z]*[-\s]\d{4})/)) ??
      (email.date ? email.date.slice(0, 10) : null);

    // "N people/pax" reads number-then-word in a covering note; "Covers N" /
    // "Guests N" on the bill itself reads word-then-number — keep these
    // separate so "Table 12   Covers 4" doesn't false-match "12" as covers.
    const covers = toNum(
      group(note, /(\d+)\s*(?:people|pax)\b/i) ?? group(src, /(?:Covers|Guests?)\s*:?\s*(\d+)/i) ?? '',
    );
    const org = group(note, /with (?:the )?([A-Za-z][\w&. ]*?(?:team|procurement|group|Ltd|Technologies)[\w&. ]*)/i);
    // Multiple covers => hosted meal until the claimant says otherwise (policy 3.5).
    const isEntertainment =
      covers >= 2 || /team|client|customer|guest|procurement|partner|vertex|hosted/i.test(note);

    return [
      {
        category: isEntertainment ? ClaimCategory.BUSINESS_ENTERTAINMENT : ClaimCategory.MEAL,
        merchant,
        lineDate,
        grossAmount: total,
        taxAmount: 0,
        paidBy: PaidBy.EMPLOYEE,
        currency: detectCurrency(src),
        reference: billNo,
        meta: {
          billNo,
          covers: covers || null,
          attendeeOrg: org,
          attendees: [] as string[],
          note: note.trim() || null,
        },
      },
    ];
  },
};
