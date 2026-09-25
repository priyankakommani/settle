import type { ClaimCategoryValue } from '@settle/shared';
import type { PolicyCaps, PolicyLineInput, PolicyVerdict, TripContext } from '../types.js';

/**
 * A rule is a pure predicate+effect. The engine runs the chain for a line's
 * category in order and stops at the first rule that returns a verdict.
 * Keeping each rule tiny and named means a failing unit test points at one file.
 */
export interface PolicyRule {
  code: string;
  appliesTo: ClaimCategoryValue | '*';
  evaluate(
    line: PolicyLineInput,
    trip: TripContext,
    caps: PolicyCaps,
  ): PolicyVerdict | null;
}

/** Registered in the code phase: companyPaidMemoRule, lodgingTariffCapRule, ... */
export const policyRules: PolicyRule[] = [];

export function rulesFor(category: ClaimCategoryValue): PolicyRule[] {
  return policyRules.filter((r) => r.appliesTo === '*' || r.appliesTo === category);
}
