import { EmployeeRole, ErrorCode } from '@settle/shared';
import { BadRequestError, ForbiddenError, NotFoundError } from '../lib/errors.js';
import { tripRepository } from '../repositories/trip.repository.js';
import { employeeRepository } from '../repositories/employee.repository.js';
import { claimLineRepository } from '../repositories/claim-line.repository.js';
import { documentRepository } from '../repositories/document.repository.js';
import { approvalRepository } from '../repositories/approval.repository.js';
import { settlementRepository } from '../repositories/settlement.repository.js';
import type { CreateTripInput } from '../validators/trip.validators.js';
import type { Employee, NewTrip, Trip } from '../db/schema/index.js';

/**
 * Orchestrates trip reads/writes. Business rules live here; SQL lives in
 * repositories; pure math lives in `domain/`. Controllers only call this.
 */
export const tripService = {
  async listForEmployee(employeeCode: string): Promise<Trip[]> {
    return tripRepository.listByEmployee(employeeCode);
  },

  async getByIdOrThrow(id: string): Promise<Trip> {
    const trip = await tripRepository.findById(id);
    if (!trip) {
      throw new NotFoundError(`Trip "${id}" not found.`, ErrorCode.TRIP_NOT_FOUND);
    }
    return trip;
  },

  /** Full aggregate for the trip-review screen. */
  async getDetail(id: string) {
    const trip = await this.getByIdOrThrow(id);
    const [documents, claimLines, approvals, settlement] = await Promise.all([
      documentRepository.listByTrip(id),
      claimLineRepository.listByTrip(id),
      approvalRepository.listByTrip(id),
      settlementRepository.findByTrip(id),
    ]);
    return { trip, documents, claimLines, approvals, settlement };
  },

  /**
   * The aggregate used by the UI. A claim belongs to its traveller, the people
   * in its approval chain, Finance, or organisation oversight (Admin / MD).
   * Keeping this check beside the aggregate prevents a guessed UUID from
   * becoming a cross-employee data leak.
   */
  async getDetailForViewer(id: string, viewer: Employee) {
    const trip = await this.getByIdOrThrow(id);
    if (!(await mayViewTrip(trip, viewer))) {
      throw new ForbiddenError('You do not have access to this travel request.', ErrorCode.FORBIDDEN);
    }
    return this.getDetail(id);
  },

  /**
   * Opens a fresh DRAFT trip for one employee. The Travel Request ID is issued
   * by the system (policy 1.1) — never supplied by the employee. `fullDays` is
   * derived from the inclusive date range when both ends are known.
   */
  async createForEmployee(employeeCode: string, input: CreateTripInput): Promise<Trip> {
    const employee = await employeeRepository.findByCode(employeeCode);
    if (!employee) {
      throw new NotFoundError(
        `Employee "${employeeCode}" not found.`,
        ErrorCode.USER_NOT_FOUND,
      );
    }

    // policy 1.2: a travel advance of up to 60% of the estimated cost may be requested
    if (
      input.advanceRequested != null &&
      input.estimatedCost != null &&
      input.advanceRequested > input.estimatedCost * 0.6 + 0.005
    ) {
      throw new BadRequestError(
        'The advance requested cannot exceed 60% of the estimated cost (policy 1.2).',
        ErrorCode.BAD_REQUEST,
        {
          estimatedCost: input.estimatedCost,
          advanceRequested: input.advanceRequested,
          maxAdvance: Math.round(input.estimatedCost * 0.6 * 100) / 100,
        },
      );
    }

    const fullDays = computeFullDays(input.startDate, input.endDate);
    const travelRequestId = await tripRepository.nextTravelRequestId();

    const row: NewTrip = {
      travelRequestId,
      employeeCode,
      purpose: input.purpose ?? null,
      originCity: input.originCity ?? null,
      destCity: input.destCity ?? null,
      destTier: input.destTier ?? null,
      isInternational:
        input.isInternational === undefined ? null : String(input.isInternational),
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      fullDays,
      estimatedCost: input.estimatedCost != null ? input.estimatedCost.toFixed(2) : null,
      advanceRequested: input.advanceRequested != null ? input.advanceRequested.toFixed(2) : null,
    };

    return tripRepository.create(row);
  },
};

export type TripService = typeof tripService;

/** Inclusive day count between two YYYY-MM-DD dates; null unless both are given. */
function computeFullDays(start?: string, end?: string): number | null {
  if (!start || !end) return null;
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const endMs = Date.parse(`${end}T00:00:00Z`);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return null;
  if (endMs < startMs) {
    throw new BadRequestError('endDate cannot be before startDate.');
  }
  return Math.round((endMs - startMs) / 86_400_000) + 1;
}

async function mayViewTrip(trip: Trip, viewer: Employee): Promise<boolean> {
  if (trip.employeeCode === viewer.empCode) return true;
  if (viewer.role === EmployeeRole.ADMIN || viewer.role === EmployeeRole.MD) return true;
  if (viewer.role === EmployeeRole.FINANCE) return true;

  const chain = await approvalRepository.listByTrip(trip.id);
  return chain.some((step) => step.approverCode === viewer.empCode);
}
