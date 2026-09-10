import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  attachments,
  rawDocuments,
  type NewAttachment,
  type NewRawDocument,
  type RawDocument,
} from '../db/schema/index.js';
import { mapDbError } from '../lib/db-error.js';

/** Data access for `raw_documents` + `attachments`. */
export const documentRepository = {
  async create(input: NewRawDocument): Promise<RawDocument> {
    try {
      const [row] = await db.insert(rawDocuments).values(input).returning();
      return row!;
    } catch (err) {
      throw mapDbError(err);
    }
  },

  async listByTrip(tripId: string): Promise<RawDocument[]> {
    try {
      return await db.select().from(rawDocuments).where(eq(rawDocuments.tripId, tripId));
    } catch (err) {
      throw mapDbError(err);
    }
  },

  async findById(id: string): Promise<RawDocument | null> {
    try {
      const rows = await db.select().from(rawDocuments).where(eq(rawDocuments.id, id)).limit(1);
      return rows[0] ?? null;
    } catch (err) {
      throw mapDbError(err);
    }
  },

  async deleteById(id: string): Promise<void> {
    try {
      // attachments cascade via FK; claim_lines.source_document_id is set null
      await db.delete(rawDocuments).where(eq(rawDocuments.id, id));
    } catch (err) {
      throw mapDbError(err);
    }
  },

  async listAttachments(rawDocumentId: string) {
    try {
      return await db
        .select()
        .from(attachments)
        .where(eq(attachments.rawDocumentId, rawDocumentId));
    } catch (err) {
      throw mapDbError(err);
    }
  },

  async deleteByTrip(tripId: string): Promise<void> {
    try {
      await db.delete(rawDocuments).where(eq(rawDocuments.tripId, tripId));
    } catch (err) {
      throw mapDbError(err);
    }
  },

  async update(id: string, patch: Partial<NewRawDocument>): Promise<RawDocument> {
    try {
      const [row] = await db
        .update(rawDocuments)
        .set(patch)
        .where(eq(rawDocuments.id, id))
        .returning();
      return row!;
    } catch (err) {
      throw mapDbError(err);
    }
  },

  async addAttachment(input: NewAttachment) {
    try {
      const [row] = await db.insert(attachments).values(input).returning();
      return row!;
    } catch (err) {
      throw mapDbError(err);
    }
  },
};

export type DocumentRepository = typeof documentRepository;
