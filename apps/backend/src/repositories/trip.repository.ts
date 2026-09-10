import { desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { trips, type NewTrip, type Trip } from '../db/schema/index.js';
import { mapDbError } from '../lib/db-error.js';

type TripStatus = Trip['status'];

/**
 * Data access for `trips`. Methods here are intentionally small; composition
 * and business rules live in the service layer.
 */
export const tripRepository = {
  async create(input: NewTrip): Promise<Trip> {
    try {
      const [row] = await db.insert(trips).values(input).returning();
      return row!;
    } catch (err) {
      throw mapDbError(err);
    }
  },

  /**
   * Issues the next Travel Request ID as `TRQ-<year>-<seq>` (policy 1.1).
   * Uses a Postgres sequence so concurrent creates never collide.
   */
  async nextTravelRequestId(): Promise<string> {
    try {
      const result = await db.execute<{ n: string | number }>(
        sql`select nextval('travel_request_seq') as n`,
      );
      const rows = (result as { rows?: Array<{ n: string | number }> }).rows ?? (result as unknown as Array<{ n: string | number }>);
      const n = Number(rows[0]?.n ?? 0);
      const year = new Date().getUTCFullYear();
      return `TRQ-${year}-${String(n).padStart(4, '0')}`;
    } catch (err) {
      throw mapDbError(err);
    }
  },

  async findById(id: string): Promise<Trip | null> {
    try {
      const rows = await db.select().from(trips).where(eq(trips.id, id)).limit(1);
      return rows[0] ?? null;
    } catch (err) {
      throw mapDbError(err);
    }
  },

  async findByTravelRequestId(travelRequestId: string): Promise<Trip | null> {
    try {
      const rows = await db
        .select()
        .from(trips)
        .where(eq(trips.travelRequestId, travelRequestId))
        .limit(1);
      return rows[0] ?? null;
    } catch (err) {
      throw mapDbError(err);
    }
  },

  async listAll(): Promise<Trip[]> {
    try {
      return await db.select().from(trips).orderBy(desc(trips.createdAt));
    } catch (err) {
      throw mapDbError(err);
    }
  },

  async listByEmployee(employeeCode: string): Promise<Trip[]> {
    try {
      return await db
        .select()
        .from(trips)
        .where(eq(trips.employeeCode, employeeCode))
        .orderBy(desc(trips.createdAt));
    } catch (err) {
      throw mapDbError(err);
    }
  },

  async listByStatus(...statuses: TripStatus[]): Promise<Trip[]> {
    if (statuses.length === 0) return [];
    try {
      return await db
        .select()
        .from(trips)
        .where(inArray(trips.status, statuses))
        .orderBy(desc(trips.submittedAt));
    } catch (err) {
      throw mapDbError(err);
    }
  },

  async update(id: string, patch: Partial<NewTrip>): Promise<Trip> {
    try {
      const [row] = await db
        .update(trips)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(trips.id, id))
        .returning();
      return row!;
    } catch (err) {
      throw mapDbError(err);
    }
  },
};

export type TripRepository = typeof tripRepository;
