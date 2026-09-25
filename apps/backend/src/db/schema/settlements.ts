import { relations } from 'drizzle-orm';
import { pgTable, uuid, numeric, timestamp } from 'drizzle-orm/pg-core';
import { trips } from './trips.js';

/**
 * The computed settlement summary (section 4 of the settlement form).
 * One row per trip. Recomputed by SettlementCalculator on every change.
 * `amountPayable` and `amountRecoverable` are mutually exclusive — exactly
 * one is non-zero (form legend).
 */
export const settlements = pgTable('settlements', {
  id: uuid('id').primaryKey().defaultRandom(),
  tripId: uuid('trip_id')
    .notNull()
    .unique()
    .references(() => trips.id, { onDelete: 'cascade' }),

  totalEmployeePaid: numeric('total_employee_paid', { precision: 14, scale: 2 }).notNull().default('0'),
  totalCompanyPaidMemo: numeric('total_company_paid_memo', { precision: 14, scale: 2 })
    .notNull()
    .default('0'),
  totalDisallowed: numeric('total_disallowed', { precision: 14, scale: 2 }).notNull().default('0'),
  netReimbursable: numeric('net_reimbursable', { precision: 14, scale: 2 }).notNull().default('0'),
  advanceDrawn: numeric('advance_drawn', { precision: 14, scale: 2 }).notNull().default('0'),
  amountPayable: numeric('amount_payable', { precision: 14, scale: 2 }).notNull().default('0'),
  amountRecoverable: numeric('amount_recoverable', { precision: 14, scale: 2 })
    .notNull()
    .default('0'),

  computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
});

export const settlementsRelations = relations(settlements, ({ one }) => ({
  trip: one(trips, { fields: [settlements.tripId], references: [trips.id] }),
}));

export type Settlement = typeof settlements.$inferSelect;
export type NewSettlement = typeof settlements.$inferInsert;
