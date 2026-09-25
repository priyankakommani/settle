import { relations } from 'drizzle-orm';
import {
  pgTable,
  pgSequence,
  uuid,
  text,
  date,
  integer,
  numeric,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { employees } from './employees.js';

/** Issues the human Travel Request ID (`TRQ-<year>-<seq>`). policy 1.1 */
export const travelRequestSeq = pgSequence('travel_request_seq', { startWith: 1, increment: 1 });
import { tripStatusEnum, cityTierEnum } from './enums.js';
import { rawDocuments } from './raw-documents.js';
import { claimLines } from './claim-lines.js';
import { approvals } from './approvals.js';
import { settlements } from './settlements.js';

/**
 * A trip == one Travel Request == one settlement claim. All downstream
 * artefacts hang off `travelRequestId` (policy 1.1).
 */
export const trips = pgTable(
  'trips',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    travelRequestId: text('travel_request_id').notNull().unique(),
    employeeCode: text('employee_code')
      .notNull()
      .references(() => employees.empCode),

    purpose: text('purpose'),
    originCity: text('origin_city'),
    destCity: text('dest_city'),
    destTier: cityTierEnum('dest_tier'),
    isInternational: text('is_international'), // 'true' | 'false' | null until known
    startDate: date('start_date'),
    endDate: date('end_date'),
    fullDays: integer('full_days'),

    // --- travel request (raised up front, before booking) ---
    /** estimated employee-borne cost declared on the request */
    estimatedCost: numeric('estimated_cost', { precision: 14, scale: 2 }),
    /** advance the employee asked for (policy 1.2: <= 60% of estimatedCost) */
    advanceRequested: numeric('advance_requested', { precision: 14, scale: 2 }),

    // --- advance actually disbursed (from the "advance credited" email) ---
    advanceRef: text('advance_ref'),
    advanceAmount: numeric('advance_amount', { precision: 14, scale: 2 }).notNull().default('0'),

    status: tripStatusEnum('status').notNull().default('DRAFT'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    employeeIdx: index('trips_employee_idx').on(t.employeeCode),
    statusIdx: index('trips_status_idx').on(t.status),
  }),
);

export const tripsRelations = relations(trips, ({ one, many }) => ({
  employee: one(employees, {
    fields: [trips.employeeCode],
    references: [employees.empCode],
  }),
  documents: many(rawDocuments),
  claimLines: many(claimLines),
  approvals: many(approvals),
  settlement: one(settlements),
}));

export type Trip = typeof trips.$inferSelect;
export type NewTrip = typeof trips.$inferInsert;
