import { relations } from 'drizzle-orm';
import { pgTable, uuid, integer, text, timestamp, unique, index } from 'drizzle-orm/pg-core';
import { trips } from './trips.js';
import { employees } from './employees.js';
import { employeeRoleEnum, approvalDecisionEnum } from './enums.js';

/**
 * One row per required approval step for a trip's claim. The set of rows is
 * (re)generated from the approval matrix each time the claim is submitted,
 * because the required chain depends on the claimed amount.
 *
 * `level` orders the chain; the lowest pending level is the current actor.
 */
export const approvals = pgTable(
  'approvals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),

    level: integer('level').notNull(),
    role: employeeRoleEnum('role').notNull(),
    approverCode: text('approver_code').references(() => employees.empCode),

    decision: approvalDecisionEnum('decision').notNull().default('pending'),
    remarks: text('remarks'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tripLevelUnique: unique('approvals_trip_level_uq').on(t.tripId, t.level),
    tripIdx: index('approvals_trip_idx').on(t.tripId),
    approverIdx: index('approvals_approver_idx').on(t.approverCode),
  }),
);

export const approvalsRelations = relations(approvals, ({ one }) => ({
  trip: one(trips, { fields: [approvals.tripId], references: [trips.id] }),
  approver: one(employees, {
    fields: [approvals.approverCode],
    references: [employees.empCode],
  }),
}));

export type Approval = typeof approvals.$inferSelect;
export type NewApproval = typeof approvals.$inferInsert;
