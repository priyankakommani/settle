import type { EmployeeRoleValue } from '@settle/shared';
import { EmployeeRole } from '@settle/shared';

/**
 * PURE. Given the claimed value + travel type, return the ordered list of
 * approval steps required by the policy matrix (section 2).
 *
 *   <= 25,000                         -> [Reporting Manager]
 *   25,001 – 75,000                   -> [Reporting Manager, Head of Department]
 *   75,001 – 2,00,000                 -> [+ Head of Division]
 *   > 2,00,000  OR  international     -> [+ MD]
 *   ...then always [Finance] (verification, section 2.1)
 *
 * Caller resolves each role to a person via the reporting chain and applies
 * "an approver cannot approve their own claim" (2.2): if the resolved approver
 * is the claimant, that level is skipped and the next level up acts.
 */

export interface ApprovalStepSpec {
  level: number;
  role: EmployeeRoleValue;
}

export interface RoutingInput {
  claimedValue: number;
  isInternational: boolean;
}

/** Matrix thresholds — mirror of policy_config approval_l{1,2,3}_max. */
const L1_MAX = 25_000;
const L2_MAX = 75_000;
const L3_MAX = 200_000;

export function requiredApprovalChain(input: RoutingInput): ApprovalStepSpec[] {
  const value = Math.max(0, input.claimedValue);
  const roles: EmployeeRoleValue[] = [EmployeeRole.REPORTING_MANAGER];

  if (value > L1_MAX) roles.push(EmployeeRole.HEAD_OF_DEPARTMENT);
  if (value > L2_MAX) roles.push(EmployeeRole.HEAD_OF_DIVISION);
  if (value > L3_MAX || input.isInternational) roles.push(EmployeeRole.MD);

  roles.push(EmployeeRole.FINANCE);

  return roles.map((role, i) => ({ level: i + 1, role }));
}
