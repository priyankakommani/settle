import { relations } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  boolean,
  numeric,
  jsonb,
  timestamp,
  index,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { trips } from './trips.js';
import { attachments } from './attachments.js';
import { documentSourceEnum, documentCategoryEnum } from './enums.js';

/**
 * One row per ingested artefact (an .eml, a pasted receipt, a manual entry).
 * Each pipeline stage writes back here so the whole run is re-playable:
 *   parsedJson  <- mail-parser
 *   category    <- classifier
 *   isNoise / isDuplicateOf <- deduper
 */
export const rawDocuments = pgTable(
  'raw_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),

    sourceType: documentSourceEnum('source_type').notNull(),
    fromAddr: text('from_addr'),
    subject: text('subject'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    messageId: text('message_id'),

    rawBlobRef: text('raw_blob_ref'), // path in STORAGE_DIR
    parsedJson: jsonb('parsed_json'),

    category: documentCategoryEnum('category').notNull().default('unknown'),
    categoryConfidence: numeric('category_confidence', { precision: 4, scale: 3 }),

    isNoise: boolean('is_noise').notNull().default(false),
    isDuplicateOf: uuid('is_duplicate_of').references((): AnyPgColumn => rawDocuments.id),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tripIdx: index('raw_documents_trip_idx').on(t.tripId),
    categoryIdx: index('raw_documents_category_idx').on(t.category),
    messageIdIdx: index('raw_documents_message_id_idx').on(t.messageId),
  }),
);

export const rawDocumentsRelations = relations(rawDocuments, ({ one, many }) => ({
  trip: one(trips, { fields: [rawDocuments.tripId], references: [trips.id] }),
  attachments: many(attachments),
  duplicateOf: one(rawDocuments, {
    fields: [rawDocuments.isDuplicateOf],
    references: [rawDocuments.id],
    relationName: 'duplicate_of',
  }),
}));

export type RawDocument = typeof rawDocuments.$inferSelect;
export type NewRawDocument = typeof rawDocuments.$inferInsert;
