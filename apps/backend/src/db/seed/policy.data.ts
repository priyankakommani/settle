import type { NewPolicyConfigRow } from '../schema/index.js';

/**
 * Nortex T&E policy NTX-HR-POL-11 Rev 4, effective 01 Apr 2026.
 * These are the numbers the policy engine reads at runtime.
 */
export const POLICY_SEED: NewPolicyConfigRow[] = [
  // 3.1 Lodging — room tariff per night, excluding taxes
  { key: 'lodging_cap_per_night', cityTier: 'TIER_1', value: '6000.00', unit: 'INR' },
  { key: 'lodging_cap_per_night', cityTier: 'TIER_2', value: '4000.00', unit: 'INR' },
  { key: 'lodging_cap_per_night', cityTier: 'TIER_3', value: '2800.00', unit: 'INR' },

  // 3.3 Meals — per full day, on actuals up to limit
  { key: 'meal_cap_per_day', cityTier: 'TIER_1', value: '1500.00', unit: 'INR' },
  { key: 'meal_cap_per_day', cityTier: 'TIER_2', value: '1000.00', unit: 'INR' },
  { key: 'meal_cap_per_day', cityTier: 'TIER_3', value: '1000.00', unit: 'INR' },
  { key: 'meal_bill_required_above', cityTier: null, value: '500.00', unit: 'INR' },

  // 3.5 Business entertainment — prior HOD approval required above this
  { key: 'be_preapproval_threshold', cityTier: null, value: '2000.00', unit: 'INR' },

  // 1.2 Advance — up to 60% of estimated employee-borne cost
  { key: 'advance_max_pct', cityTier: null, value: '60.00', unit: 'percent' },

  // 2 Approval matrix thresholds
  { key: 'approval_l1_max', cityTier: null, value: '25000.00', unit: 'INR' },
  { key: 'approval_l2_max', cityTier: null, value: '75000.00', unit: 'INR' },
  { key: 'approval_l3_max', cityTier: null, value: '200000.00', unit: 'INR' },

  // 5.1 Submission window
  { key: 'submission_window_days', cityTier: null, value: '7.00', unit: 'days' },
];
