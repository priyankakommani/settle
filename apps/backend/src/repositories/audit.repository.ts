import { desc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { auditLog, type AuditLogRow, type NewAuditLogRow } from '../db/schema/index.js';
import { mapDbError } from '../lib/db-error.js';

/** Append-only trail of state-changing actions on a trip (Finance reconciliation). */
export const auditRepository = {
  async record(entry: NewAuditLogRow): Promise<void> {
    try {
      await db.insert(auditLog).values(entry);
    } catch (err) {
      throw mapDbError(err);
    }
  },

  async listByTrip(tripId: string): Promise<AuditLogRow[]> {
    try {
      return await db
        .select()
        .from(auditLog)
        .where(eq(auditLog.tripId, tripId))
        .orderBy(desc(auditLog.at));
    } catch (err) {
      throw mapDbError(err);
    }
  },
};

export type AuditRepository = typeof auditRepository;
