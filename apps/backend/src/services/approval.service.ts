import { ApprovalDecision, EmployeeRole, ErrorCode, TripStatus, type EmployeeRoleValue } from '@settle/shared';
import { ConflictError, ForbiddenError, NotFoundError } from '../lib/errors.js';
import { requiredApprovalChain } from '../domain/approval/routing.js';
import { toNum } from '../lib/num.js';
import { approvalRepository } from '../repositories/approval.repository.js';
import { employeeRepository } from '../repositories/employee.repository.js';
import { settlementRepository } from '../repositories/settlement.repository.js';
import { tripRepository } from '../repositories/trip.repository.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { tripService } from './trip.service.js';
import { notificationService } from './notification.service.js';
import type { Approval, Employee, NewApproval, Trip } from '../db/schema/index.js';

/** Seniority rank so we can resolve "this role or higher" up the reporting chain. */
const RANK: Record<EmployeeRoleValue, number> = {
  [EmployeeRole.EMPLOYEE]: 0,
  [EmployeeRole.REPORTING_MANAGER]: 1,
  [EmployeeRole.HEAD_OF_DEPARTMENT]: 2,
  [EmployeeRole.HEAD_OF_DIVISION]: 3,
  [EmployeeRole.MD]: 4,
  [EmployeeRole.FINANCE]: 5,
  // Admin is not part of the reporting hierarchy, but has a rank so the
  // exhaustive shared role vocabulary remains type-safe.
  [EmployeeRole.ADMIN]: 6,
};

/**
 * Drives the approval chain.
 *  - buildChain: routing spec -> people via the reporting chain, skipping any
 *    level whose approver would be the claimant (policy 2.2); Finance appended.
 *  - decide: lowest pending business level only, "cannot approve own claim",
 *    advance state; last business approval -> PENDING_FINANCE.
 */
export const approvalService = {
  async buildChain(tripId: string, claimedValue?: number): Promise<Approval[]> {
    const trip = await tripService.getByIdOrThrow(tripId);
    const value =
      claimedValue ?? toNum((await settlementRepository.findByTrip(tripId))?.netReimbursable);

    const spec = requiredApprovalChain({
      claimedValue: value,
      isInternational: trip.isInternational === 'true',
    });

    const everyone = await employeeRepository.listAll();
    const byCode = new Map(everyone.map((e) => [e.empCode, e]));
    const reportingChain = climb(trip.employeeCode, byCode);
    const financeCode = everyone.find((e) => e.role === EmployeeRole.FINANCE)?.empCode ?? null;

    const steps: NewApproval[] = spec.map((s, i) => ({
      tripId,
      level: i + 1,
      role: s.role,
      approverCode:
        s.role === EmployeeRole.FINANCE
          ? financeCode
          : resolveApprover(s.role, reportingChain, trip.employeeCode),
      decision: ApprovalDecision.PENDING,
    }));

    const saved = await approvalRepository.replaceChain(tripId, steps);
    await auditRepository.record({
      tripId,
      actorCode: trip.employeeCode,
      action: 'approval.chain.build',
      afterJson: saved.map((s) => ({ level: s.level, role: s.role, approverCode: s.approverCode })),
    });
    return saved;
  },

  async decide(
    tripId: string,
    level: number,
    actorCode: string,
    decision: 'approved' | 'rejected' | 'returned',
    remarks?: string,
  ) {
    const trip = await tripService.getByIdOrThrow(tripId);
    if (trip.status !== TripStatus.PENDING_APPROVAL) {
      throw new ConflictError(
        `Trip is ${trip.status}, not awaiting business approval.`,
        ErrorCode.INVALID_STATE_TRANSITION,
      );
    }

    const chain = await approvalRepository.listByTrip(tripId);
    const step = chain.find((s) => s.level === level);
    if (!step) {
      throw new NotFoundError(`Approval step ${level} not found.`, ErrorCode.APPROVAL_STEP_NOT_FOUND);
    }
    if (step.role === EmployeeRole.FINANCE) {
      throw new ForbiddenError(
        'Finance verification is done through /api/finance, not the approval chain.',
        ErrorCode.ROLE_NOT_PERMITTED,
      );
    }
    if (step.decision !== ApprovalDecision.PENDING) {
      throw new ConflictError(`Step ${level} is already ${step.decision}.`, ErrorCode.APPROVAL_OUT_OF_ORDER);
    }

    const lowestPending = chain
      .filter((s) => s.role !== EmployeeRole.FINANCE && s.decision === ApprovalDecision.PENDING)
      .sort((a, b) => a.level - b.level)[0];
    if (lowestPending && lowestPending.level !== level) {
      throw new ConflictError(
        `Step ${lowestPending.level} (${lowestPending.role}) must be actioned first.`,
        ErrorCode.APPROVAL_OUT_OF_ORDER,
      );
    }

    if (trip.employeeCode === actorCode) {
      throw new ForbiddenError(
        'An approver cannot approve their own claim (policy 2.2).',
        ErrorCode.APPROVER_IS_CLAIMANT,
      );
    }
    if (step.approverCode && step.approverCode !== actorCode) {
      throw new ForbiddenError(
        `Step ${level} is assigned to ${step.approverCode}.`,
        ErrorCode.FORBIDDEN,
      );
    }

    await approvalRepository.update(step.id, {
      decision,
      remarks: remarks ?? null,
      approverCode: actorCode,
      decidedAt: new Date(),
    });

    let nextStatus: Trip['status'] = trip.status;
    if (decision === ApprovalDecision.REJECTED) nextStatus = TripStatus.REJECTED;
    else if (decision === ApprovalDecision.RETURNED) nextStatus = TripStatus.RETURNED;
    else {
      const businessPendingLeft = chain.filter(
        (s) => s.role !== EmployeeRole.FINANCE && s.decision === ApprovalDecision.PENDING && s.level !== level,
      );
      if (businessPendingLeft.length === 0) nextStatus = TripStatus.PENDING_FINANCE;
    }

    const updated = await tripRepository.update(tripId, { status: nextStatus });
    await auditRepository.record({
      tripId,
      actorCode,
      action: `approval.${decision}`,
      beforeJson: { status: trip.status, level },
      afterJson: { status: updated.status, level, remarks: remarks ?? null },
    });

    await notificationService.approvalProgressed({
      trip: updated,
      chain,
      decidedLevel: level,
      decision,
      nextStatus,
      remarks: remarks ?? null,
    });

    return tripService.getDetail(tripId);
  },
};

export type ApprovalService = typeof approvalService;

/* ------------------------------------------------------------------ */

/** claimant -> manager -> manager's manager -> ... (excludes the claimant). */
function climb(startCode: string, byCode: Map<string, Employee>): Employee[] {
  const chain: Employee[] = [];
  let current = byCode.get(startCode)?.reportingManagerCode ?? null;
  const guard = new Set<string>();
  while (current && !guard.has(current)) {
    guard.add(current);
    const emp = byCode.get(current);
    if (!emp) break;
    chain.push(emp);
    current = emp.reportingManagerCode ?? null;
  }
  return chain;
}

/** Lowest person in the reporting chain at or above the required role, never the claimant. */
function resolveApprover(
  role: EmployeeRoleValue,
  reportingChain: Employee[],
  claimantCode: string,
): string | null {
  const need = RANK[role];
  const match = reportingChain.find(
    (e) => e.empCode !== claimantCode && RANK[e.role as EmployeeRoleValue] >= need,
  );
  return (match ?? reportingChain[reportingChain.length - 1])?.empCode ?? null;
}
