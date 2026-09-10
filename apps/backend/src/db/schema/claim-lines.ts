import { relations } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  date,
  numeric,
  boolean,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { trips } from './trips.js';
import { rawDocuments } from './raw-documents.js';
import { claimCategoryEnum, paidByEnum, policyVerdictEnum } from './enums.js';

/**
 * One reimbursable (or disallowed, or memo) line on the settlement claim.
 * `sourceDocumentId` is the proof reference. Policy 5.2: a line with no proof
 * is returned — enforced at submit time, not here.
 *
 * The policy engine writes: verdict, allowedAmount, disallowedAmount,
 * reasonCode, reasonText. It never deletes a line — disallowed items stay
 * visible (settlement form legend).
 */
export const claimLines = pgTable(
  'claim_lines',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    sourceDocumentId: uuid('source_document_id').references(() => rawDocuments.id, {
      onDelete: 'set null',
    }),

    category: claimCategoryEnum('category').notNull(),
    merchant: text('merchant'),
    description: text('description'),
    lineDate: date('line_date'),
    currency: text('currency').notNull().default('INR'),

    grossAmount: numeric('gross_amount', { precision: 14, scale: 2 }).notNull().default('0'),
    taxAmount: numeric('tax_amount', { precision: 14, scale: 2 }).notNull().default('0'),
    paidBy: paidByEnum('paid_by').notNull().default('Employee'),

    policyVerdict: policyVerdictEnum('policy_verdict'),
    allowedAmount: numeric('allowed_amount', { precision: 14, scale: 2 }).notNull().default('0'),
    disallowedAmount: numeric('disallowed_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0'),
    reasonCode: text('reason_code'),
    reasonText: text('reason_text'),
    /** structured evidence the engine used / needs (e.g. missing attendee names) */
    policyMeta: jsonb('policy_meta'),

    proofRef: text('proof_ref'),
    editedByUser: boolean('edited_by_user').notNull().default(false),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tripIdx: index('claim_lines_trip_idx').on(t.tripId),
    categoryIdx: index('claim_lines_category_idx').on(t.category),
    verdictIdx: index('claim_lines_verdict_idx').on(t.policyVerdict),
  }),
);

export const claimLinesRelations = relations(claimLines, ({ one }) => ({
  trip: one(trips, { fields: [claimLines.tripId], references: [trips.id] }),
  sourceDocument: one(rawDocuments, {
    fields: [claimLines.sourceDocumentId],
    references: [rawDocuments.id],
  }),
}));

export type ClaimLine = typeof claimLines.$inferSelect;
export type NewClaimLine = typeof claimLines.$inferInsert;
