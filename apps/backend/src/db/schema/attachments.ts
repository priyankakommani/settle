import { relations } from 'drizzle-orm';
import { pgTable, uuid, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { rawDocuments } from './raw-documents.js';

/** Binary attachments (receipt images) pulled off an email or uploaded directly. */
export const attachments = pgTable(
  'attachments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    rawDocumentId: uuid('raw_document_id')
      .notNull()
      .references(() => rawDocuments.id, { onDelete: 'cascade' }),

    filename: text('filename').notNull(),
    mime: text('mime').notNull(),
    sizeBytes: integer('size_bytes'),
    blobRef: text('blob_ref').notNull(), // path in STORAGE_DIR

    ocrText: text('ocr_text'),
    ocrStatus: text('ocr_status').notNull().default('pending'), // pending | done | failed | skipped

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    docIdx: index('attachments_doc_idx').on(t.rawDocumentId),
  }),
);

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  rawDocument: one(rawDocuments, {
    fields: [attachments.rawDocumentId],
    references: [rawDocuments.id],
  }),
}));

export type Attachment = typeof attachments.$inferSelect;
export type NewAttachment = typeof attachments.$inferInsert;
