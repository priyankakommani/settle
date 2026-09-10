import { ApprovalDecision, EmployeeRole, TripStatus } from '@settle/shared';
import { approvalRepository } from '../repositories/approval.repository.js';
import { tripRepository } from '../repositories/trip.repository.js';
import { settlementRepository } from '../repositories/settlement.repository.js';
import { employeeRepository } from '../repositories/employee.repository.js';
import { toNum } from '../lib/num.js';
import type { Trip } from '../db/schema/index.js';

/** One row of a work queue — matches the frontend `QueueRow` DTO. */
export interface QueueRow {
  tripId: string;
  travelRequestId: string;
  employeeName: string;
  destCity: string | null;
  netReimbursable: string | null;
  status: Trip['status'];
  waitingSince: string | null;
  currentLevel: number | null;
}

/**
 * Read models for the approver and finance work queues.
 *  - pendingApprovalsFor(approverCode): trips whose lowest pending business
 *    approval step is assigned to this person.
 *  - pendingFinance(): trips in PENDING_FINANCE / VERIFIED.
 */
export const queueService = {
  async pendingApprovalsFor(approverCode: string): Promise<QueueRow[]> {
    const mySteps = await approvalRepository.listByApprover(approverCode, ApprovalDecision.PENDING);
    const rows: QueueRow[] = [];

    for (const step of mySteps) {
      if (step.role === EmployeeRole.FINANCE) continue;
      const trip = await tripRepository.findById(step.tripId);
      if (!trip || trip.status !== TripStatus.PENDING_APPROVAL) continue;

      const chain = await approvalRepository.listByTrip(step.tripId);
      const lowestPending = chain
        .filter((s) => s.role !== EmployeeRole.FINANCE && s.decision === ApprovalDecision.PENDING)
        .sort((a, b) => a.level - b.level)[0];
      if (!lowestPending || lowestPending.level !== step.level) continue;

      rows.push(await toRow(trip, step.level));
    }
    return rows;
  },

  async pendingFinance(): Promise<QueueRow[]> {
    const trips = await tripRepository.listByStatus(TripStatus.PENDING_FINANCE, TripStatus.VERIFIED);
    return Promise.all(trips.map((trip) => toRow(trip, null)));
  },

  /** Every claim in the system — admin / MD oversight view. */
  async allClaims(): Promise<QueueRow[]> {
    const trips = await tripRepository.listAll();
    return Promise.all(trips.map((trip) => toRow(trip, null)));
  },
};

export type QueueService = typeof queueService;

/* ------------------------------------------------------------------ */

async function toRow(trip: Trip, currentLevel: number | null): Promise<QueueRow> {
  const [employee, settlement] = await Promise.all([
    employeeRepository.findByCode(trip.employeeCode),
    settlementRepository.findByTrip(trip.id),
  ]);
  return {
    tripId: trip.id,
    travelRequestId: trip.travelRequestId,
    employeeName: employee?.name ?? trip.employeeCode,
    destCity: trip.destCity,
    netReimbursable: settlement ? String(toNum(settlement.netReimbursable).toFixed(2)) : null,
    status: trip.status,
    waitingSince: trip.submittedAt ? trip.submittedAt.toISOString() : null,
    currentLevel,
  };
}
