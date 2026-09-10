import { and, asc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { approvals, type Approval, type NewApproval } from '../db/schema/index.js';
import { mapDbError } from '../lib/db-error.js';

type ApprovalDecision = Approval['decision'];

/** Data access for `approvals`. */
export const approvalRepository = {
  async replaceChain(tripId: string, steps: NewApproval[]): Promise<Approval[]> {
    try {
      return await db.transaction(async (tx) => {
        await tx.delete(approvals).where(eq(approvals.tripId, tripId));
        if (steps.length === 0) return [];
        return tx.insert(approvals).values(steps).returning();
      });
    } catch (err) {
      throw mapDbError(err);
    }
  },

  async listByTrip(tripId: string): Promise<Approval[]> {
    try {
      return await db
        .select()
        .from(approvals)
        .where(eq(approvals.tripId, tripId))
        .orderBy(asc(approvals.level));
    } catch (err) {
      throw mapDbError(err);
    }
  },

  async listByApprover(approverCode: string, decision: ApprovalDecision = 'pending'): Promise<Approval[]> {
    try {
      return await db
        .select()
        .from(approvals)
        .where(and(eq(approvals.approverCode, approverCode), eq(approvals.decision, decision)))
        .orderBy(asc(approvals.level));
    } catch (err) {
      throw mapDbError(err);
    }
  },

  async findStep(tripId: string, level: number): Promise<Approval | null> {
    try {
      const rows = await db
        .select()
        .from(approvals)
        .where(and(eq(approvals.tripId, tripId), eq(approvals.level, level)))
        .limit(1);
      return rows[0] ?? null;
    } catch (err) {
      throw mapDbError(err);
    }
  },

  async update(id: string, patch: Partial<NewApproval>): Promise<Approval> {
    try {
      const [row] = await db.update(approvals).set(patch).where(eq(approvals.id, id)).returning();
      return row!;
    } catch (err) {
      throw mapDbError(err);
    }
  },
};

export type ApprovalRepository = typeof approvalRepository;
