import type { PaidByValue, PolicyVerdictValue } from '@settle/shared';
import { PaidBy } from '@settle/shared';
import { round2 } from '../../lib/num.js';

/** PURE. Maps evaluated claim lines -> the settlement summary numbers. */

export interface SettlementLineInput {
  paidBy: PaidByValue;
  verdict: PolicyVerdictValue;
  grossAmount: number;
  allowedAmount: number;
  disallowedAmount: number;
}

export interface SettlementResult {
  totalEmployeePaid: number;
  totalCompanyPaidMemo: number;
  totalDisallowed: number;
  netReimbursable: number;
  advanceDrawn: number;
  amountPayable: number;
  amountRecoverable: number;
}

/**
 * netReimbursable = sum(allowedAmount where paidBy === 'Employee')
 * balance         = netReimbursable - advanceDrawn
 *   balance >= 0  -> amountPayable = balance,      amountRecoverable = 0
 *   balance <  0  -> amountPayable = 0,            amountRecoverable = -balance
 * (payable and recoverable are mutually exclusive — form legend)
 *
 * Company-paid lines (corporate card) are memo only: they add to
 * totalCompanyPaidMemo and never touch the reimbursable math.
 */
export function computeSettlement(
  lines: SettlementLineInput[],
  advanceDrawn: number,
): SettlementResult {
  let totalEmployeePaid = 0;
  let totalCompanyPaidMemo = 0;
  let totalDisallowed = 0;
  let netReimbursable = 0;

  for (const l of lines) {
    if (l.paidBy === PaidBy.COMPANY) {
      totalCompanyPaidMemo += l.grossAmount;
      continue;
    }
    totalEmployeePaid += l.grossAmount;
    totalDisallowed += l.disallowedAmount;
    netReimbursable += l.allowedAmount;
  }

  netReimbursable = round2(netReimbursable);
  const advance = round2(advanceDrawn);
  const balance = round2(netReimbursable - advance);

  return {
    totalEmployeePaid: round2(totalEmployeePaid),
    totalCompanyPaidMemo: round2(totalCompanyPaidMemo),
    totalDisallowed: round2(totalDisallowed),
    netReimbursable,
    advanceDrawn: advance,
    amountPayable: balance >= 0 ? balance : 0,
    amountRecoverable: balance < 0 ? round2(-balance) : 0,
  };
}
