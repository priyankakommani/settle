import { ClaimCategory, PaidBy, PolicyVerdict } from '@settle/shared';
import { round2, toNum } from '../../lib/num.js';
import type { PolicyCaps, PolicyLineInput, PolicyVerdict as Verdict, TripContext } from './types.js';

/**
 * PURE. No I/O, no Date.now(), no db. Deterministic: same inputs -> same output.
 * Exactly one verdict per line. Disallowed items are never dropped — they come
 * back with verdict 'disallowed' and disallowedAmount = gross so the form can
 * show them (settlement legend / policy 3.1, 4).
 */

/** Substrings that are never reimbursable (policy 4). Matched against meta.kind. */
const NON_REIMBURSABLE = [
  'laundry',
  'mini bar',
  'minibar',
  'in-room dining',
  'in room dining',
  'in-room entertainment',
  'spa',
  'gym',
  'alcohol',
  'liquor',
  'bar',
  'fine',
  'penalty',
  'challan',
  'insurance',
  'personal phone',
  'data charge',
];

export function evaluateLine(
  line: PolicyLineInput,
  trip: TripContext,
  caps: PolicyCaps,
): Verdict {
  const gross = round2(line.grossAmount);
  const tax = round2(line.taxAmount);
  const meta = line.meta ?? {};

  // 1. Company-paid (corporate card) -> memo only, never reimbursed.
  if (line.paidBy === PaidBy.COMPANY) {
    return verdict(line, PolicyVerdict.ALLOWED, 0, 0, 'COMPANY_PAID', 'Billed to the company (corporate card). Memo only — not reimbursed.');
  }

  // 2. Expense of another person (policy 4).
  if (meta.incurredByOther === true) {
    const who = typeof meta.rider === 'string' ? ` (${meta.rider})` : '';
    return verdict(line, PolicyVerdict.DISALLOWED, 0, gross, 'OTHER_PERSON', `Expense incurred by someone other than the claimant${who} — not reimbursable (policy 4).`);
  }

  // 3. Hard non-reimbursables by kind (folio extras, alcohol, fines, ...).
  const kind = String(meta.kind ?? '').toLowerCase();
  if (kind && NON_REIMBURSABLE.some((k) => kind.includes(k))) {
    return verdict(line, PolicyVerdict.DISALLOWED, 0, gross, 'NON_REIMBURSABLE', `${meta.kind as string} is on the non-reimbursable list (policy 4) — shown as disallowed, not dropped.`);
  }

  switch (line.category) {
    case ClaimCategory.LODGING:
      return evalLodging(line, trip, caps, gross, tax);
    case ClaimCategory.CONVEYANCE:
      return evalConveyance(line, gross);
    case ClaimCategory.MEAL:
      return evalMeal(line, trip, caps, gross);
    case ClaimCategory.BUSINESS_ENTERTAINMENT:
      return evalBusinessEntertainment(line, caps, gross);
    default:
      return evalOther(line);
  }
}

export function evaluateAll(
  lines: PolicyLineInput[],
  trip: TripContext,
  caps: PolicyCaps,
): Verdict[] {
  return lines.map((l) => evaluateLine(l, trip, caps));
}

/* ------------------------------------------------------------------ *
 * per-category                                                       *
 * ------------------------------------------------------------------ */

function evalLodging(
  line: PolicyLineInput,
  trip: TripContext,
  caps: PolicyCaps,
  gross: number,
  tax: number,
): Verdict {
  if (!line.hasProof) {
    return needsInfo(line, 'LODGING_NO_PROOF', 'Lodging needs the hotel tax invoice.', ['hotel tax invoice']);
  }

  const meta = line.meta ?? {};
  const nights = Math.max(1, Math.round(toNum(meta.nights) || trip.fullDays || 1));
  const capPerNight = caps.lodgingCapPerNight[trip.destTier];
  const cap = round2(capPerNight * nights);

  // tariff = room charge ex-tax; room tax is reimbursable in full (policy 3.1).
  const roomTax = round2(toNum(meta.roomTax) || tax);
  const tariff = round2(toNum(meta.tariffPerNight) ? toNum(meta.tariffPerNight) * nights : gross - roomTax);

  const allowedTariff = Math.min(tariff, cap);
  const disallowedTariff = round2(Math.max(0, tariff - cap));
  const allowed = round2(allowedTariff + roomTax);

  if (disallowedTariff > 0) {
    return verdict(
      line,
      PolicyVerdict.CAPPED,
      allowed,
      disallowedTariff,
      'LODGING_OVER_CAP',
      `Room tariff ${inr(tariff)} over the ${tierName(trip.destTier)} limit of ${inr(cap)} for ${nights} night(s). ${inr(disallowedTariff)} disallowed; room tax reimbursed in full.`,
    );
  }
  return verdict(
    line,
    PolicyVerdict.ALLOWED,
    allowed,
    0,
    'LODGING_WITHIN_LIMIT',
    `Room tariff within the ${tierName(trip.destTier)} limit (${inr(capPerNight)}/night); room tax reimbursed in full.`,
  );
}

function evalConveyance(line: PolicyLineInput, gross: number): Verdict {
  if (!line.hasProof) {
    return needsInfo(line, 'CONVEYANCE_NO_PROOF', 'Local conveyance is reimbursed on actuals against a receipt (policy 3.4).', ['receipt']);
  }
  return verdict(line, PolicyVerdict.ALLOWED, gross, 0, 'CONVEYANCE_ACTUALS', 'Local conveyance reimbursed on actuals against receipt (policy 3.4).');
}

function evalMeal(
  line: PolicyLineInput,
  trip: TripContext,
  caps: PolicyCaps,
  gross: number,
): Verdict {
  if (gross > caps.mealBillRequiredAbove && !line.hasProof) {
    return needsInfo(line, 'MEAL_NO_BILL', `A meal above ${inr(caps.mealBillRequiredAbove)} needs a bill (policy 3.3).`, ['itemised bill']);
  }
  const days = Math.max(1, trip.fullDays);
  const perDay = caps.mealCapPerDay[trip.destTier];
  const cap = round2(perDay * days);
  if (gross > cap) {
    return verdict(
      line,
      PolicyVerdict.CAPPED,
      cap,
      round2(gross - cap),
      'MEAL_OVER_CAP',
      `Meal actuals ${inr(gross)} over the allowance of ${inr(cap)} (${inr(perDay)}/day × ${days} full day(s)).`,
    );
  }
  return verdict(line, PolicyVerdict.ALLOWED, gross, 0, 'MEAL_WITHIN_LIMIT', `Within the daily meal allowance (${inr(cap)}).`);
}

function evalBusinessEntertainment(
  line: PolicyLineInput,
  caps: PolicyCaps,
  gross: number,
): Verdict {
  const meta = line.meta ?? {};
  const attendees = meta.attendees;
  const hasNames = Array.isArray(attendees)
    ? attendees.length > 0
    : typeof attendees === 'string' && attendees.trim().length > 0;
  const hasOrg = Boolean(meta.attendeeOrg ?? meta.org);
  const preApproved = meta.preApproved === true || Boolean(meta.preApprovalRef);

  const missing: string[] = [];
  if (!hasNames) missing.push('attendee names');
  if (!hasOrg) missing.push('attendee organisation');
  if (!line.hasProof) missing.push('bill');
  if (gross > caps.bePreapprovalThreshold && !preApproved) {
    missing.push(`Head of Department pre-approval (amount over ${inr(caps.bePreapprovalThreshold)})`);
  }

  if (missing.length > 0) {
    return {
      ...needsInfo(line, 'BE_INCOMPLETE', `Business entertainment claim is missing: ${missing.join('; ')} (policy 3.5).`, missing),
    };
  }
  return verdict(line, PolicyVerdict.ALLOWED, gross, 0, 'BE_COMPLETE', 'Business entertainment with attendees, organisation and pre-approval on record (policy 3.5).');
}

function evalOther(line: PolicyLineInput): Verdict {
  if (!line.hasProof) {
    return needsInfo(line, 'OTHER_NO_PROOF', 'Every claim line needs a supporting document (policy 5.2).', ['supporting document']);
  }
  return needsInfo(line, 'OTHER_UNCATEGORISED', 'Uncategorised expense — needs a category before it can be assessed.', ['category']);
}

/* ------------------------------------------------------------------ *
 * helpers                                                            *
 * ------------------------------------------------------------------ */

function verdict(
  line: PolicyLineInput,
  v: Verdict['verdict'],
  allowedAmount: number,
  disallowedAmount: number,
  reasonCode: string,
  reasonText: string,
): Verdict {
  return {
    lineId: line.id,
    verdict: v,
    allowedAmount: round2(allowedAmount),
    disallowedAmount: round2(disallowedAmount),
    reasonCode,
    reasonText,
  };
}

function needsInfo(
  line: PolicyLineInput,
  reasonCode: string,
  reasonText: string,
  missing: string[],
): Verdict {
  return {
    lineId: line.id,
    verdict: PolicyVerdict.NEEDS_INFO,
    allowedAmount: 0,
    disallowedAmount: 0,
    reasonCode,
    reasonText,
    missing,
  };
}

function inr(n: number): string {
  return `INR ${round2(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function tierName(t: 'TIER_1' | 'TIER_2' | 'TIER_3'): string {
  return { TIER_1: 'Tier 1', TIER_2: 'Tier 2', TIER_3: 'Tier 3' }[t];
}
