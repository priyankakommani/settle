import { ApprovalDecision, EmployeeRole, TripStatus } from '@settle/shared';
import { logger } from '../lib/logger.js';
import { notificationRepository } from '../repositories/notification.repository.js';
import { employeeRepository } from '../repositories/employee.repository.js';
import { settlementRepository } from '../repositories/settlement.repository.js';
import type { Approval, NewNotification, Trip } from '../db/schema/index.js';

/**
 * Raises inbox notifications on workflow transitions. Every public method is
 * wrapped by `safeEmit` — a notification failure is logged and swallowed so it
 * can NEVER break the claim / approval / finance flow that triggered it.
 */

type Emit = Omit<
  Pick<NewNotification, 'recipientCode' | 'type' | 'title' | 'body' | 'tripId' | 'link'>,
  'recipientCode'
> & { recipientCode: string | null | undefined };

async function safeEmit(rows: Emit[]): Promise<void> {
  const clean: NewNotification[] = rows
    .filter((r): r is Emit & { recipientCode: string } => Boolean(r.recipientCode))
    .map((r) => ({ ...r }));
  if (clean.length === 0) return;
  try {
    await notificationRepository.createMany(clean);
  } catch (err) {
    logger.warn({ err, count: clean.length }, 'notification.emit.failed');
  }
}

async function nameOf(code: string | null | undefined): Promise<string> {
  if (!code) return 'Someone';
  try {
    const e = await employeeRepository.findByCode(code);
    return e?.name ?? code;
  } catch {
    return code;
  }
}

function lowestPendingBusinessStep(chain: Approval[], afterLevel = 0): Approval | undefined {
  return chain
    .filter(
      (s) =>
        s.role !== EmployeeRole.FINANCE &&
        s.decision === ApprovalDecision.PENDING &&
        s.level > afterLevel,
    )
    .sort((a, b) => a.level - b.level)[0];
}

function financeStep(chain: Approval[]): Approval | undefined {
  return chain.find((s) => s.role === EmployeeRole.FINANCE);
}

export const notificationService = {
  /** Claim just submitted -> the first business approver (or finance if none). */
  async claimSubmitted(trip: Trip, chain: Approval[]): Promise<void> {
    const claimant = await nameOf(trip.employeeCode);
    const next = lowestPendingBusinessStep(chain) ?? financeStep(chain);
    if (!next) return;
    const toFinance = next.role === EmployeeRole.FINANCE;
    await safeEmit([
      {
        recipientCode: next.approverCode ?? null,
        type: toFinance ? 'finance_pending' : 'approval_pending',
        title: toFinance
          ? `Claim ready for finance — ${trip.travelRequestId}`
          : `New claim to review — ${trip.travelRequestId}`,
        body: `${claimant}'s travel claim was submitted for ${next.role.toLowerCase()} action.`,
        tripId: trip.id,
        link: toFinance ? `/finance/${trip.id}` : `/approvals/${trip.id}`,
      },
    ]);
  },

  /** An approver decided. Route the next notification by decision + resulting status. */
  async approvalProgressed(params: {
    trip: Trip;
    chain: Approval[];
    decidedLevel: number;
    decision: 'approved' | 'rejected' | 'returned';
    nextStatus: Trip['status'];
    remarks?: string | null;
  }): Promise<void> {
    const { trip, chain, decidedLevel, decision, nextStatus, remarks } = params;

    if (decision === ApprovalDecision.APPROVED) {
      const step = chain.find((s) => s.level === decidedLevel);
      const roleName = step?.role ? step.role.toLowerCase() : 'approver';

      if (nextStatus === TripStatus.PENDING_FINANCE) {
        const fin = financeStep(chain);
        await safeEmit([
          {
            recipientCode: fin?.approverCode ?? null,
            type: 'finance_pending',
            title: `Claim ready for finance — ${trip.travelRequestId}`,
            body: 'All business approvals are complete. Finance verification is pending.',
            tripId: trip.id,
            link: `/finance/${trip.id}`,
          },
          {
            recipientCode: trip.employeeCode,
            type: 'claim_approved',
            title: `Claim approved by ${roleName} — ${trip.travelRequestId}`,
            body: `Your claim was approved by ${roleName} and has moved to Finance for verification.`,
            tripId: trip.id,
            link: `/trips/${trip.id}?tab=approvals`,
          },
        ]);
        return;
      }
      const next = lowestPendingBusinessStep(chain, decidedLevel);
      if (next) {
        await safeEmit([
          {
            recipientCode: next.approverCode ?? null,
            type: 'approval_pending',
            title: `Claim awaiting your approval — ${trip.travelRequestId}`,
            body: `Approved at the previous level. Now with ${next.role.toLowerCase()}.`,
            tripId: trip.id,
            link: `/approvals/${trip.id}`,
          },
          {
            recipientCode: trip.employeeCode,
            type: 'claim_approved',
            title: `Claim approved by ${roleName} — ${trip.travelRequestId}`,
            body: `Your claim was approved by ${roleName} and moved to ${next.role.toLowerCase()} for approval.`,
            tripId: trip.id,
            link: `/trips/${trip.id}?tab=approvals`,
          },
        ]);
      }
      return;
    }

    // returned / rejected -> back to the claimant
    const returned = decision === ApprovalDecision.RETURNED;
    await safeEmit([
      {
        recipientCode: trip.employeeCode,
        type: returned ? 'claim_returned' : 'claim_rejected',
        title: returned
          ? `Claim returned for correction — ${trip.travelRequestId}`
          : `Claim rejected — ${trip.travelRequestId}`,
        body: remarks ? `Remarks: ${remarks}` : undefined,
        tripId: trip.id,
        link: returned ? `/trips/${trip.id}?tab=claim` : `/trips/${trip.id}`,
      },
    ]);
  },

  async financeVerified(trip: Trip): Promise<void> {
    await safeEmit([
      {
        recipientCode: trip.employeeCode,
        type: 'claim_verified',
        title: `Claim verified by finance — ${trip.travelRequestId}`,
        body: 'Your claim passed finance verification. Payment will follow in the next run.',
        tripId: trip.id,
        link: `/trips/${trip.id}?tab=settlement`,
      },
    ]);
  },

  async financeReturned(trip: Trip, remarks: string): Promise<void> {
    await safeEmit([
      {
        recipientCode: trip.employeeCode,
        type: 'claim_returned',
        title: `Claim returned by finance — ${trip.travelRequestId}`,
        body: `Remarks: ${remarks}`,
        tripId: trip.id,
        link: `/trips/${trip.id}?tab=claim`,
      },
    ]);
  },

  async paymentReleased(trip: Trip, paymentRunDate: string): Promise<void> {
    let line = 'Payment has been released.';
    try {
      const s = await settlementRepository.findByTrip(trip.id);
      if (s) {
        const payable = Number(s.amountPayable);
        const recoverable = Number(s.amountRecoverable);
        line =
          recoverable > 0
            ? `₹${recoverable.toFixed(2)} is recoverable and will be adjusted in payroll.`
            : `₹${payable.toFixed(2)} will be credited in the payment run on ${paymentRunDate}.`;
      }
    } catch {
      /* fall back to the generic line */
    }
    await safeEmit([
      {
        recipientCode: trip.employeeCode,
        type: 'payment_released',
        title: `Payment released — ${trip.travelRequestId}`,
        body: line,
        tripId: trip.id,
        link: `/trips/${trip.id}?tab=settlement`,
      },
    ]);
  },
};

export type NotificationService = typeof notificationService;
