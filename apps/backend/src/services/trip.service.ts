import { EmployeeRole, ErrorCode, TripStatus } from '@settle/shared';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../lib/errors.js';
import { removeBlob } from '../lib/blob-storage.js';
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
    const [rawDocuments, claimLines, approvals, settlement, attachmentRows] = await Promise.all([
      documentRepository.listByTrip(id),
      claimLineRepository.listByTrip(id),
      approvalRepository.listByTrip(id),
      settlementRepository.findByTrip(id),
      documentRepository.listAttachmentsByTrip(id),
    ]);

    // Every document ships its own attachments (name/size/mime, OCR status +
    // text) so the UI can show exactly what was read from each upload,
    // instead of just a bare subject line.
    const attachmentsByDoc = new Map<string, typeof attachmentRows>();
    for (const a of attachmentRows) {
      const list = attachmentsByDoc.get(a.rawDocumentId) ?? [];
      list.push(a);
      attachmentsByDoc.set(a.rawDocumentId, list);
    }
    const documents = rawDocuments.map((doc) => ({
      ...doc,
      attachments: attachmentsByDoc.get(doc.id) ?? [],
    }));

    return { trip, documents, claimLines, approvals, settlement };
  },

  /**
   * The aggregate used by the UI. A claim belongs to its traveller, the people
   * in its approval chain, Finance, or organisation oversight (Admin / MD).
   * Keeping this check beside the aggregate prevents a guessed UUID from
   * becoming a cross-employee data leak.
   */
  async getDetailForViewer(id: string, viewer: Employee) {
    const trip = await this.assertViewable(id, viewer);
    return this.getDetail(trip.id);
  },

  /** Same access rule as `getDetailForViewer`, for endpoints that don't need the full aggregate. */
  async assertViewable(id: string, viewer: Employee): Promise<Trip> {
    const trip = await this.getByIdOrThrow(id);
    if (!(await mayViewTrip(trip, viewer))) {
      throw new ForbiddenError('You do not have access to this travel request.', ErrorCode.FORBIDDEN);
    }
    return trip;
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

  /**
   * Full replace of the trip-request fields (same shape as create) — the
   * frontend resends the whole form, not a partial patch, so an omitted
   * field means "cleared", matching how create treats `undefined`.
   */
  async updateForEmployee(tripId: string, actorCode: string, input: CreateTripInput): Promise<Trip> {
    const trip = await this.getByIdOrThrow(tripId);
    assertClaimant(trip, actorCode);
    assertEditable(trip);

    const fullDays = computeFullDays(input.startDate, input.endDate);

    return tripRepository.update(tripId, {
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
    });
  },

  /**
   * Permanently removes a DRAFT trip and everything under it. Only DRAFT —
   * once submitted the trip is part of someone else's approval/finance
   * workflow, so it can be returned but never simply deleted.
   */
  async deleteForEmployee(tripId: string, actorCode: string): Promise<void> {
    const trip = await this.getByIdOrThrow(tripId);
    assertClaimant(trip, actorCode);
    if (trip.status !== TripStatus.DRAFT) {
      throw new ConflictError(
        `A trip in state ${trip.status} cannot be deleted — only a DRAFT trip can be removed.`,
        ErrorCode.CLAIM_NOT_EDITABLE,
      );
    }

    // Clean up on-disk blobs before the DB cascade removes the rows that reference them.
    const docs = await documentRepository.listByTrip(tripId);
    const attachmentLists = await Promise.all(docs.map((d) => documentRepository.listAttachments(d.id)));
    await Promise.all([
      ...docs.map((d) => removeBlob(d.rawBlobRef)),
      ...attachmentLists.flat().map((a) => removeBlob(a.blobRef)),
    ]);

    await tripRepository.remove(tripId);
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

function assertClaimant(trip: { employeeCode: string }, actorCode: string): void {
  if (trip.employeeCode !== actorCode) {
    throw new ForbiddenError('Only the claimant can change this trip.', ErrorCode.FORBIDDEN);
  }
}

function assertEditable(trip: { status: string }): void {
  if (trip.status !== TripStatus.DRAFT && trip.status !== TripStatus.RETURNED) {
    throw new ConflictError(
      `The trip request can only change while the trip is DRAFT or RETURNED (currently ${trip.status}).`,
      ErrorCode.CLAIM_NOT_EDITABLE,
    );
  }
}
