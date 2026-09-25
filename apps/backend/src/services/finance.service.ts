import { ApprovalDecision, EmployeeRole, ErrorCode, TripStatus } from '@settle/shared';
import { ConflictError } from '../lib/errors.js';
import { nextPaymentRun } from '../lib/dates.js';
import { approvalRepository } from '../repositories/approval.repository.js';
import { tripRepository } from '../repositories/trip.repository.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { tripService } from './trip.service.js';
import { notificationService } from './notification.service.js';

/**
 * Finance-only actions after business approvals are complete (policy 2.1).
 *  - verify(tripId): PENDING_FINANCE -> VERIFIED
 *  - returnToEmployee(tripId): PENDING_FINANCE | VERIFIED -> RETURNED (with remarks)
 *  - releasePayment(tripId): VERIFIED -> PAID, stamped with the next payment run
 *    date (10th / 25th, policy 5.4)
 */
export const financeService = {
  async verify(tripId: string, actorCode: string, remarks?: string) {
    const trip = await tripService.getByIdOrThrow(tripId);
    if (trip.status !== TripStatus.PENDING_FINANCE) {
      throw new ConflictError(
        `Trip is ${trip.status}; Finance can only verify a claim in PENDING_FINANCE.`,
        ErrorCode.INVALID_STATE_TRANSITION,
      );
    }

    await closeFinanceStep(tripId, actorCode, ApprovalDecision.APPROVED, remarks);
    const updated = await tripRepository.update(tripId, { status: TripStatus.VERIFIED });
    await auditRepository.record({
      tripId,
      actorCode,
      action: 'finance.verify',
      beforeJson: { status: trip.status },
      afterJson: { status: updated.status, remarks: remarks ?? null },
    });
    await notificationService.financeVerified(updated);
    return tripService.getDetail(tripId);
  },

  async returnToEmployee(tripId: string, actorCode: string, remarks: string) {
    const trip = await tripService.getByIdOrThrow(tripId);
    if (trip.status !== TripStatus.PENDING_FINANCE && trip.status !== TripStatus.VERIFIED) {
      throw new ConflictError(
        `Trip is ${trip.status}; Finance can only return a claim in PENDING_FINANCE or VERIFIED.`,
        ErrorCode.INVALID_STATE_TRANSITION,
      );
    }

    await closeFinanceStep(tripId, actorCode, ApprovalDecision.RETURNED, remarks);
    const updated = await tripRepository.update(tripId, { status: TripStatus.RETURNED });
    await auditRepository.record({
      tripId,
      actorCode,
      action: 'finance.return',
      beforeJson: { status: trip.status },
      afterJson: { status: updated.status, remarks },
    });
    await notificationService.financeReturned(updated, remarks);
    return tripService.getDetail(tripId);
  },

  async releasePayment(tripId: string, actorCode: string) {
    const trip = await tripService.getByIdOrThrow(tripId);
    if (trip.status !== TripStatus.VERIFIED) {
      throw new ConflictError(
        `Trip is ${trip.status}; payment can only be released for a VERIFIED claim.`,
        ErrorCode.INVALID_STATE_TRANSITION,
      );
    }

    const paymentRunDate = nextPaymentRun();
    const updated = await tripRepository.update(tripId, { status: TripStatus.PAID });
    await auditRepository.record({
      tripId,
      actorCode,
      action: 'finance.pay',
      beforeJson: { status: trip.status },
      afterJson: { status: updated.status, paymentRunDate },
    });

    await notificationService.paymentReleased(updated, paymentRunDate);

    const detail = await tripService.getDetail(tripId);
    return { ...detail, paymentRunDate };
  },
};

export type FinanceService = typeof financeService;

/* ------------------------------------------------------------------ */

async function closeFinanceStep(
  tripId: string,
  actorCode: string,
  decision: (typeof ApprovalDecision)[keyof typeof ApprovalDecision],
  remarks?: string,
): Promise<void> {
  const chain = await approvalRepository.listByTrip(tripId);
  const financeStep = chain.find((s) => s.role === EmployeeRole.FINANCE);
  if (financeStep && financeStep.decision === ApprovalDecision.PENDING) {
    await approvalRepository.update(financeStep.id, {
      decision,
      approverCode: actorCode,
      remarks: remarks ?? null,
      decidedAt: new Date(),
    });
  }
}
