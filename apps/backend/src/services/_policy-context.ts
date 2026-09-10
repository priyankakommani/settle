import type { Trip } from '../db/schema/index.js';
import type { PolicyCaps, TripContext } from '../domain/policy/types.js';
import { policyConfigRepository } from '../repositories/policy-config.repository.js';
import { inclusiveDays } from '../lib/dates.js';
import { toNum } from '../lib/num.js';

type Tier = 'TIER_1' | 'TIER_2' | 'TIER_3';

/** Load the policy caps the engine needs from `policy_config` (no numbers in code). */
export async function loadPolicyCaps(): Promise<PolicyCaps> {
  const rows = await policyConfigRepository.all();
  const val = (key: string, tier: Tier | null): number =>
    toNum(rows.find((r) => r.key === key && r.cityTier === tier)?.value);

  return {
    lodgingCapPerNight: {
      TIER_1: val('lodging_cap_per_night', 'TIER_1'),
      TIER_2: val('lodging_cap_per_night', 'TIER_2'),
      TIER_3: val('lodging_cap_per_night', 'TIER_3'),
    },
    mealCapPerDay: {
      TIER_1: val('meal_cap_per_day', 'TIER_1'),
      TIER_2: val('meal_cap_per_day', 'TIER_2'),
      TIER_3: val('meal_cap_per_day', 'TIER_3'),
    },
    bePreapprovalThreshold: val('be_preapproval_threshold', null),
    mealBillRequiredAbove: val('meal_bill_required_above', null),
  };
}

/** Map a trip row to the pure `TripContext` the policy engine consumes. */
export function buildTripContext(trip: Trip): TripContext {
  return {
    destTier: (trip.destTier ?? 'TIER_1') as Tier,
    fullDays: trip.fullDays ?? inclusiveDays(trip.startDate, trip.endDate) ?? 1,
    claimantCode: trip.employeeCode,
    isInternational: trip.isInternational === 'true',
  };
}
