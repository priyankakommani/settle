import { computeSettlement, type SettlementLineInput } from '../domain/settlement/settlement-calculator.js';
import { claimLineRepository } from '../repositories/claim-line.repository.js';
import { settlementRepository } from '../repositories/settlement.repository.js';
import { tripService } from './trip.service.js';
import { money, toNum } from '../lib/num.js';
import type { Settlement } from '../db/schema/index.js';

/**
 * Thin wrapper that loads evaluated claim lines + the trip advance, calls the
 * pure `computeSettlement`, and upserts the `settlements` row. Called by
 * claimService.recompute and after every approval-neutral edit.
 */
export const settlementService = {
  async recomputeForTrip(tripId: string): Promise<Settlement> {
    const trip = await tripService.getByIdOrThrow(tripId);
    const lines = await claimLineRepository.listByTrip(tripId);

    const inputs: SettlementLineInput[] = lines.map((l) => ({
      paidBy: l.paidBy,
      verdict: l.policyVerdict ?? 'needs_info',
      grossAmount: toNum(l.grossAmount),
      allowedAmount: toNum(l.allowedAmount),
      disallowedAmount: toNum(l.disallowedAmount),
    }));

    const result = computeSettlement(inputs, toNum(trip.advanceAmount));

    return settlementRepository.upsert({
      tripId,
      totalEmployeePaid: money(result.totalEmployeePaid),
      totalCompanyPaidMemo: money(result.totalCompanyPaidMemo),
      totalDisallowed: money(result.totalDisallowed),
      netReimbursable: money(result.netReimbursable),
      advanceDrawn: money(result.advanceDrawn),
      amountPayable: money(result.amountPayable),
      amountRecoverable: money(result.amountRecoverable),
    });
  },
};

export type SettlementService = typeof settlementService;
