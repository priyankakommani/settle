import { pgTable, uuid, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { trips } from './trips.js';

/**
 * Append-only trail of every state-changing action on a trip: who did what,
 * with a before/after snapshot. Needed for Finance reconciliation and to
 * explain any number on the claim.
 */
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tripId: uuid('trip_id').references(() => trips.id, { onDelete: 'cascade' }),
    actorCode: text('actor_code'),
    action: text('action').notNull(),
    beforeJson: jsonb('before_json'),
    afterJson: jsonb('after_json'),
    requestId: text('request_id'),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tripIdx: index('audit_log_trip_idx').on(t.tripId),
    atIdx: index('audit_log_at_idx').on(t.at),
  }),
);

export type AuditLogRow = typeof auditLog.$inferSelect;
export type NewAuditLogRow = typeof auditLog.$inferInsert;
