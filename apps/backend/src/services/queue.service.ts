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
 *  - allClaims(): every trip (admin / MD oversight).
 *
 * All three build their rows through `toRows()`, which resolves the employee
 * name + settlement for a whole batch of trips in a fixed number of queries.
 * The earlier per-trip fan-out (`Promise.all(trips.map(...))` with two queries
 * each) could ask for the entire connection pool at once and made Postgres
 * reject connections with SQLSTATE 53300 on small instances.
 */
export const queueService = {
  async pendingApprovalsFor(approverCode: string): Promise<QueueRow[]> {
    const mySteps = await approvalRepository.listByApprover(approverCode, ApprovalDecision.PENDING);
    const matched: Array<{ trip: Trip; level: number }> = [];

    for (const step of mySteps) {
      if (step.role === EmployeeRole.FINANCE) continue;
      const trip = await tripRepository.findById(step.tripId);
      if (!trip || trip.status !== TripStatus.PENDING_APPROVAL) continue;

      const chain = await approvalRepository.listByTrip(step.tripId);
      const lowestPending = chain
        .filter((s) => s.role !== EmployeeRole.FINANCE && s.decision === ApprovalDecision.PENDING)
        .sort((a, b) => a.level - b.level)[0];
      if (!lowestPending || lowestPending.level !== step.level) continue;

      matched.push({ trip, level: step.level });
    }

    const levelByTrip = new Map(matched.map((m) => [m.trip.id, m.level]));
    return toRows(
      matched.map((m) => m.trip),
      (tripId) => levelByTrip.get(tripId) ?? null,
    );
  },

  async pendingFinance(): Promise<QueueRow[]> {
    const trips = await tripRepository.listByStatus(TripStatus.PENDING_FINANCE, TripStatus.VERIFIED);
    return toRows(trips);
  },

  /** Every claim in the system — admin / MD oversight view. */
  async allClaims(): Promise<QueueRow[]> {
    const trips = await tripRepository.listAll();
    return toRows(trips);
  },
};

export type QueueService = typeof queueService;

/* ------------------------------------------------------------------ */

/**
 * Turn a batch of trips into queue rows with a fixed query count (2), instead
 * of two queries per trip. `levelFor` supplies the approval level for a trip,
 * defaulting to null for queues that don't track it.
 */
async function toRows(
  trips: Trip[],
  levelFor: (tripId: string) => number | null = () => null,
): Promise<QueueRow[]> {
  if (trips.length === 0) return [];

  const [employees, settlements] = await Promise.all([
    employeeRepository.listAll(),
    settlementRepository.listByTripIds(trips.map((t) => t.id)),
  ]);
  const nameByCode = new Map(employees.map((e) => [e.empCode, e.name]));
  const settlementByTrip = new Map(settlements.map((s) => [s.tripId, s]));

  return trips.map((trip) => {
    const settlement = settlementByTrip.get(trip.id);
    return {
      tripId: trip.id,
      travelRequestId: trip.travelRequestId,
      employeeName: nameByCode.get(trip.employeeCode) ?? trip.employeeCode,
      destCity: trip.destCity,
      netReimbursable: settlement ? String(toNum(settlement.netReimbursable).toFixed(2)) : null,
      status: trip.status,
      waitingSince: toIso(trip.submittedAt),
      currentLevel: levelFor(trip.id),
    };
  });
}

/** Defensive ISO formatting — tolerates a Date, a date string, or a bad value. */
function toIso(value: Date | string | null): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
