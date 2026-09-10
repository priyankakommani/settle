import type { ClaimCategoryValue, PaidByValue, PolicyVerdictValue } from '@settle/shared';

/**
 * Pure inputs/outputs for the policy engine. NO database rows here — the
 * service layer maps `claim_lines` -> `PolicyLineInput` and back.
 */

export interface PolicyCaps {
  /** room tariff per night, ex-tax, keyed by tier */
  lodgingCapPerNight: Record<'TIER_1' | 'TIER_2' | 'TIER_3', number>;
  /** meal allowance per full day, keyed by tier */
  mealCapPerDay: Record<'TIER_1' | 'TIER_2' | 'TIER_3', number>;
  /** business entertainment amount above which prior HOD approval is required */
  bePreapprovalThreshold: number;
  /** min bill value that requires a supporting bill for meals */
  mealBillRequiredAbove: number;
}

export interface TripContext {
  destTier: 'TIER_1' | 'TIER_2' | 'TIER_3';
  fullDays: number;
  claimantCode: string;
  isInternational: boolean;
}

export interface PolicyLineInput {
  id: string;
  category: ClaimCategoryValue;
  merchant: string | null;
  lineDate: string | null;
  grossAmount: number;
  taxAmount: number;
  paidBy: PaidByValue;
  hasProof: boolean;
  /** free-form structured hints from extraction / user (attendees, nights, tariffPerNight, ...) */
  meta?: Record<string, unknown>;
}

export interface PolicyVerdict {
  lineId: string;
  verdict: PolicyVerdictValue;
  allowedAmount: number;
  disallowedAmount: number;
  reasonCode: string;
  reasonText: string;
  /** what a human still needs to supply, when verdict === 'needs_info' */
  missing?: string[];
}
