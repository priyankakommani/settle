import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { claimLines, type ClaimLine, type NewClaimLine } from '../db/schema/index.js';
import { mapDbError } from '../lib/db-error.js';

/** Data access for `claim_lines`. */
export const claimLineRepository = {
  async create(input: NewClaimLine): Promise<ClaimLine> {
    try {
      const [row] = await db.insert(claimLines).values(input).returning();
      return row!;
    } catch (err) {
      throw mapDbError(err);
    }
  },

  async bulkCreate(input: NewClaimLine[]): Promise<ClaimLine[]> {
    if (input.length === 0) return [];
    try {
      return await db.insert(claimLines).values(input).returning();
    } catch (err) {
      throw mapDbError(err);
    }
  },

  async findById(id: string): Promise<ClaimLine | null> {
    try {
      const rows = await db.select().from(claimLines).where(eq(claimLines.id, id)).limit(1);
      return rows[0] ?? null;
    } catch (err) {
      throw mapDbError(err);
    }
  },

  async listByTrip(tripId: string): Promise<ClaimLine[]> {
    try {
      return await db.select().from(claimLines).where(eq(claimLines.tripId, tripId));
    } catch (err) {
      throw mapDbError(err);
    }
  },

  async update(id: string, patch: Partial<NewClaimLine>): Promise<ClaimLine> {
    try {
      const [row] = await db
        .update(claimLines)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(claimLines.id, id))
        .returning();
      return row!;
    } catch (err) {
      throw mapDbError(err);
    }
  },

  async remove(id: string): Promise<void> {
    try {
      await db.delete(claimLines).where(eq(claimLines.id, id));
    } catch (err) {
      throw mapDbError(err);
    }
  },
};

export type ClaimLineRepository = typeof claimLineRepository;
