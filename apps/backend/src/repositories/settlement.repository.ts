import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { settlements, type NewSettlement, type Settlement } from '../db/schema/index.js';
import { mapDbError } from '../lib/db-error.js';

/** Data access for `settlements` (one row per trip). */
export const settlementRepository = {
  async upsert(input: NewSettlement): Promise<Settlement> {
    try {
      const [row] = await db
        .insert(settlements)
        .values(input)
        .onConflictDoUpdate({
          target: settlements.tripId,
          set: { ...input, computedAt: new Date() },
        })
        .returning();
      return row!;
    } catch (err) {
      throw mapDbError(err);
    }
  },

  async findByTrip(tripId: string): Promise<Settlement | null> {
    try {
      const rows = await db
        .select()
        .from(settlements)
        .where(eq(settlements.tripId, tripId))
        .limit(1);
      return rows[0] ?? null;
    } catch (err) {
      throw mapDbError(err);
    }
  },
};

export type SettlementRepository = typeof settlementRepository;
