import { ErrorCode, TripStatus } from '@settle/shared';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnprocessableError,
} from '../lib/errors.js';
import { SUBMISSION_WINDOW_DAYS } from '../config/constants.js';
import { daysSince } from '../lib/dates.js';
import { money, toNum } from '../lib/num.js';
import { evaluateLine } from '../domain/policy/policy-engine.js';
import type { PolicyLineInput } from '../domain/policy/types.js';
import { claimLineRepository } from '../repositories/claim-line.repository.js';
import { tripRepository } from '../repositories/trip.repository.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { tripService } from './trip.service.js';
import { settlementService } from './settlement.service.js';
import { approvalService } from './approval.service.js';
import { notificationService } from './notification.service.js';
import { loadPolicyCaps, buildTripContext } from './_policy-context.js';
import type { AddClaimLineInput, EditClaimLineInput } from '../validators/claim-line.validators.js';
import type { ClaimLine, Trip } from '../db/schema/index.js';

const EDITABLE: Trip['status'][] = [TripStatus.DRAFT, TripStatus.RETURNED];

/**
 * Owns the claim lines + the submit gate.
 *  - addLine / editLine / removeLine   (only while trip is DRAFT or RETURNED)
 *  - recompute: re-run policy engine + settlement calculator, persist verdicts
 *  - submit: validate (every line has proof, no `needs_info` lines left,
 *            within 7-day window), build the approval chain, move state to
 *            PENDING_APPROVAL
 */
export const claimService = {
  async addLine(tripId: string, actorCode: string, input: AddClaimLineInput) {
    const trip = await tripService.getByIdOrThrow(tripId);
    assertClaimant(trip, actorCode);
    assertEditable(trip);

    const line = await claimLineRepository.create({
      tripId,
      category: input.category,
      merchant: input.merchant ?? null,
      description: input.description ?? null,
      lineDate: input.lineDate ?? null,
      currency: input.currency,
      grossAmount: money(input.grossAmount),
      taxAmount: money(input.taxAmount ?? 0),
      paidBy: input.paidBy,
      sourceDocumentId: input.sourceDocumentId ?? null,
      proofRef: input.proofRef ?? null,
      policyMeta: input.meta ?? null,
      editedByUser: true,
    });

    await this.recompute(tripId);
    await auditRepository.record({
      tripId,
      actorCode,
      action: 'claim_line.add',
      afterJson: line,
    });
    return claimLineRepository.findById(line.id);
  },

  async editLine(lineId: string, actorCode: string, patch: EditClaimLineInput) {
    const line = await getLineOrThrow(lineId);
    const trip = await tripService.getByIdOrThrow(line.tripId);
    assertClaimant(trip, actorCode);
    assertEditable(trip);

    const next: Parameters<typeof claimLineRepository.update>[1] = { editedByUser: true };
    if (patch.category !== undefined) next.category = patch.category;
    if (patch.merchant !== undefined) next.merchant = patch.merchant ?? null;
    if (patch.description !== undefined) next.description = patch.description ?? null;
    if (patch.lineDate !== undefined) next.lineDate = patch.lineDate ?? null;
    if (patch.currency !== undefined) next.currency = patch.currency;
    if (patch.grossAmount !== undefined) next.grossAmount = money(patch.grossAmount);
    if (patch.taxAmount !== undefined) next.taxAmount = money(patch.taxAmount);
    if (patch.paidBy !== undefined) next.paidBy = patch.paidBy;
    if (patch.sourceDocumentId !== undefined) next.sourceDocumentId = patch.sourceDocumentId ?? null;
    if (patch.proofRef !== undefined) next.proofRef = patch.proofRef ?? null;

    const baseMeta = asObject(line.policyMeta);
    // First hand-edit of a machine-extracted line: snapshot what the pipeline
    // originally read, so an approver sees "claimant changed X -> Y" against a
    // real reference point instead of just a bare "edited by user" flag.
    const snapshot =
      !line.editedByUser && baseMeta.originalExtraction === undefined
        ? {
            category: line.category,
            merchant: line.merchant,
            lineDate: line.lineDate,
            currency: line.currency,
            grossAmount: line.grossAmount,
          }
        : undefined;
    next.policyMeta = {
      ...baseMeta,
      ...(patch.meta ?? {}),
      ...(snapshot ? { originalExtraction: snapshot } : {}),
    };

    const updated = await claimLineRepository.update(lineId, next);
    await this.recompute(line.tripId);
    await auditRepository.record({
      tripId: line.tripId,
      actorCode,
      action: 'claim_line.edit',
      beforeJson: line,
      afterJson: updated,
    });
    return claimLineRepository.findById(lineId);
  },

  async removeLine(lineId: string, actorCode: string) {
    const line = await getLineOrThrow(lineId);
    const trip = await tripService.getByIdOrThrow(line.tripId);
    assertClaimant(trip, actorCode);
    assertEditable(trip);

    await claimLineRepository.remove(lineId);
    await this.recompute(line.tripId);
    await auditRepository.record({
      tripId: line.tripId,
      actorCode,
      action: 'claim_line.remove',
      beforeJson: line,
    });
  },

  /** Re-run the policy engine over every line, persist verdicts, recompute the settlement. */
  async recompute(tripId: string, actorCode?: string) {
    const trip = await tripService.getByIdOrThrow(tripId);
    if (actorCode) {
      assertClaimant(trip, actorCode);
      assertEditable(trip);
    }
    const caps = await loadPolicyCaps();
    const ctx = buildTripContext(trip);
    const lines = await claimLineRepository.listByTrip(tripId);

    for (const line of lines) {
      const input: PolicyLineInput = {
        id: line.id,
        category: line.category,
        merchant: line.merchant,
        lineDate: line.lineDate,
        grossAmount: toNum(line.grossAmount),
        taxAmount: toNum(line.taxAmount),
        paidBy: line.paidBy,
        hasProof: Boolean(line.sourceDocumentId ?? line.proofRef),
        meta: asObject(line.policyMeta),
      };
      const v = evaluateLine(input, ctx, caps);
      await claimLineRepository.update(line.id, {
        policyVerdict: v.verdict,
        allowedAmount: money(v.allowedAmount),
        disallowedAmount: money(v.disallowedAmount),
        reasonCode: v.reasonCode,
        reasonText: v.reasonText,
        policyMeta: { ...asObject(line.policyMeta), missing: v.missing ?? [] },
      });
    }

    const settlement = await settlementService.recomputeForTrip(tripId);
    const claimLines = await claimLineRepository.listByTrip(tripId);
    return { claimLines, settlement };
  },

  async submit(tripId: string, actorCode: string) {
    const trip = await tripService.getByIdOrThrow(tripId);
    if (trip.employeeCode !== actorCode) {
      throw new ForbiddenError('Only the claimant can submit this claim.');
    }
    if (!EDITABLE.includes(trip.status)) {
      throw new ConflictError(
        `A claim in state ${trip.status} cannot be submitted.`,
        ErrorCode.CLAIM_ALREADY_SUBMITTED,
      );
    }

    const { claimLines, settlement } = await this.recompute(tripId);
    if (claimLines.length === 0) {
      throw new BadRequestError('Nothing to submit — the claim has no lines.');
    }

    const noProof = claimLines.filter((l) => !(l.sourceDocumentId ?? l.proofRef));
    if (noProof.length > 0) {
      throw new UnprocessableError(
        `${noProof.length} claim line(s) have no supporting document (policy 5.2).`,
        ErrorCode.CLAIM_MISSING_PROOF,
        { lineIds: noProof.map((l) => l.id) },
      );
    }

    const unresolved = claimLines.filter((l) => l.policyVerdict === 'needs_info');
    if (unresolved.length > 0) {
      throw new UnprocessableError(
        `${unresolved.length} claim line(s) still need information before submission.`,
        ErrorCode.CLAIM_HAS_UNRESOLVED_LINES,
        {
          lineIds: unresolved.map((l) => l.id),
          missing: unresolved.map((l) => ({ id: l.id, missing: asObject(l.policyMeta).missing ?? [] })),
        },
      );
    }

    // Policy 5.1: 7 calendar days from return. Surfaced as a warning, not a hard
    // block — the advance still has to be settled. (See project note.)
    const warnings: string[] = [];
    const since = daysSince(trip.endDate);
    if (since !== null && since > SUBMISSION_WINDOW_DAYS) {
      warnings.push(
        `Submitted ${since} days after return — outside the ${SUBMISSION_WINDOW_DAYS}-day window (policy 5.1).`,
      );
    }

    const chain = await approvalService.buildChain(tripId, toNum(settlement.netReimbursable));
    const updated = await tripRepository.update(tripId, {
      status: TripStatus.PENDING_APPROVAL,
      submittedAt: new Date(),
    });
    await auditRepository.record({
      tripId,
      actorCode,
      action: 'claim.submit',
      beforeJson: trip,
      afterJson: { status: updated.status, chain: chain.map((c) => ({ level: c.level, role: c.role, approverCode: c.approverCode })) },
    });

    await notificationService.claimSubmitted(updated, chain);

    const detail = await tripService.getDetail(tripId);
    return { ...detail, warnings };
  },
};

export type ClaimService = typeof claimService;

/* ------------------------------------------------------------------ */

function assertEditable(trip: Trip): void {
  if (!EDITABLE.includes(trip.status)) {
    throw new ConflictError(
      `Claim lines can only change while the trip is DRAFT or RETURNED (currently ${trip.status}).`,
      ErrorCode.CLAIM_NOT_EDITABLE,
    );
  }
}

function assertClaimant(trip: Trip, actorCode: string): void {
  if (trip.employeeCode !== actorCode) {
    throw new ForbiddenError('Only the claimant can change this claim.', ErrorCode.FORBIDDEN);
  }
}

async function getLineOrThrow(lineId: string): Promise<ClaimLine> {
  const line = await claimLineRepository.findById(lineId);
  if (!line) {
    throw new NotFoundError(`Claim line "${lineId}" not found.`, ErrorCode.CLAIM_LINE_NOT_FOUND);
  }
  return line;
}

function asObject(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}
