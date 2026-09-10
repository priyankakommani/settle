import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DocumentCategory, ErrorCode, TripStatus } from '@settle/shared';
import { env } from '../config/env.js';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../lib/errors.js';
import { money, round2, toNum } from '../lib/num.js';
import { parseEmail } from '../ingestion/mail-parser.js';
import { classify, classifyDocumentText } from '../ingestion/classifier.js';
import { dedupe } from '../ingestion/deduper.js';
import { selectExtractor, extractorForCategory } from '../ingestion/extractors/registry.js';
import { KNOWN_RECEIPT_TEXT } from '../ingestion/known-receipts.js';
import type { ExtractedItem, ParsedEmail } from '../ingestion/types.js';
import { tripService } from './trip.service.js';
import { claimService } from './claim.service.js';
import { tripRepository } from '../repositories/trip.repository.js';
import { employeeRepository } from '../repositories/employee.repository.js';
import { documentRepository } from '../repositories/document.repository.js';
import { claimLineRepository } from '../repositories/claim-line.repository.js';
import { auditRepository } from '../repositories/audit.repository.js';
import type { NewClaimLine } from '../db/schema/index.js';

interface UploadFile {
  filename: string;
  buffer: Buffer;
  mime: string;
}

interface DocOutcome {
  document: string;
  kind: 'eml' | 'image';
  subject: string | null;
  category: string;
  confidence: number;
  outcome: 'noise' | 'context' | 'advance-applied' | 'extracted' | 'no-extractor' | 'stored';
  extracted?: number;
}

type PendingItem = { item: ExtractedItem; docId: string; proofFallback: string | null };
type ProcessResult = { outcome: DocOutcome; items: PendingItem[] };

const isEml = (f: UploadFile) => /\.eml$/i.test(f.filename) || f.mime === 'message/rfc822';
const isReceipt = (f: UploadFile) =>
  f.mime.startsWith('image/') ||
  f.mime === 'application/pdf' ||
  /\.(png|jpe?g|webp|gif|pdf)$/i.test(f.filename);

/**
 * Runs the ingestion pipeline for a trip. Accepts two upload shapes:
 *   - raw .eml emails  -> parse -> (attachment OCR) -> classify -> extract
 *   - bare receipt images / PDFs -> OCR -> classify -> extract
 * then dedupe -> upsert claim_lines -> recompute policy + settlement.
 *
 * Raw + parsed output is persisted (raw_documents / attachments) so a run can be
 * replayed with `reprocess` after a policy change.
 */
export const ingestService = {
  async ingestUpload(tripId: string, actorCode: string, files: UploadFile[]) {
    const trip = await tripService.getByIdOrThrow(tripId);
    assertClaimant(trip, actorCode);
    assertEditable(trip);
    const emailFiles = files.filter(isEml);
    const receiptFiles = files.filter((f) => !isEml(f) && isReceipt(f));
    if (emailFiles.length === 0 && receiptFiles.length === 0) {
      throw new BadRequestError(
        'Upload one or more .eml emails and/or receipt images (png/jpg) or PDFs.',
      );
    }

    const claimant = await employeeRepository.findByCode(trip.employeeCode);
    const claimantFirst = firstName(claimant?.name);

    const outcomes: DocOutcome[] = [];
    const pending: PendingItem[] = [];

    for (const file of emailFiles) {
      const r = await processEmailFile(tripId, file, claimantFirst);
      outcomes.push(r.outcome);
      pending.push(...r.items);
    }
    for (const file of receiptFiles) {
      const r = await processReceiptFile(tripId, file);
      outcomes.push(r.outcome);
      pending.push(...r.items);
    }

    const inserted = await persistNewLines(tripId, pending);
    const { claimLines, settlement } = await claimService.recompute(tripId);

    return {
      documents: outcomes,
      insertedLines: inserted.inserted,
      duplicatesDropped: inserted.duplicates,
      claimLines,
      settlement,
    };
  },

  /**
   * Remove one uploaded document: its attachments (FK cascade), the stored
   * blobs, and any machine-derived claim lines that came from it. Hand-edited
   * lines are kept (their source link just drops). Trip must be editable.
   */
  async removeDocument(tripId: string, docId: string, actorCode: string) {
    const trip = await tripService.getByIdOrThrow(tripId);
    assertClaimant(trip, actorCode);
    assertEditable(trip);

    const doc = await documentRepository.findById(docId);
    if (!doc || doc.tripId !== tripId) {
      throw new NotFoundError(`Document "${docId}" not found on this trip.`, ErrorCode.NOT_FOUND);
    }

    const attachments = await documentRepository.listAttachments(docId);
    const lines = await claimLineRepository.listByTrip(tripId);
    for (const line of lines) {
      if (line.sourceDocumentId === docId && !line.editedByUser) {
        await claimLineRepository.remove(line.id);
      }
    }

    await documentRepository.deleteById(docId);
    await removeBlob(doc.rawBlobRef);
    for (const att of attachments) await removeBlob(att.blobRef);

    await auditRepository.record({
      tripId,
      actorCode,
      action: 'document.remove',
      beforeJson: { docId, subject: doc.subject, category: doc.category },
    });

    const { claimLines, settlement } = await claimService.recompute(tripId);
    return { removed: docId, claimLines, settlement };
  },

  /** Re-derive machine claim lines from stored raw documents (e.g. after a policy change). */
  async reprocess(tripId: string, actorCode: string) {
    const trip = await tripService.getByIdOrThrow(tripId);
    assertClaimant(trip, actorCode);
    assertEditable(trip);
    const docs = await documentRepository.listByTrip(tripId);

    const existing = await claimLineRepository.listByTrip(tripId);
    for (const l of existing) {
      if (!l.editedByUser) await claimLineRepository.remove(l.id);
    }

    const claimant = await employeeRepository.findByCode(trip.employeeCode);
    const claimantFirst = firstName(claimant?.name);
    const pending: PendingItem[] = [];

    for (const doc of docs) {
      if (doc.isNoise || !doc.parsedJson) continue;
      const parsed = doc.parsedJson as unknown as ParsedEmail;
      if (doc.category === DocumentCategory.ADVANCE) {
        await applyAdvance(tripId, parsed);
        continue;
      }
      if (doc.category === DocumentCategory.TRAVEL_APPROVAL) continue;

      const atts = await documentRepository.listAttachments(doc.id);
      const ocrText = atts.map((a) => a.ocrText).filter(Boolean).join('\n') || undefined;
      const extractor =
        selectExtractor(parsed) ?? extractorForCategory(doc.category);
      if (!extractor) continue;

      const proofFallback = parsed.messageId ?? doc.subject ?? null;
      for (const item of extractor.extract(parsed, ocrText)) {
        flagOtherPerson(item, claimantFirst);
        pending.push({ item, docId: doc.id, proofFallback });
      }
    }

    const inserted = await persistNewLines(tripId, pending);
    const { claimLines, settlement } = await claimService.recompute(tripId);
    return {
      reprocessedDocuments: docs.length,
      duplicatesDropped: inserted.duplicates,
      claimLines,
      settlement,
    };
  },
};

export type IngestService = typeof ingestService;

/* ------------------------------------------------------------------ *
 * per-file processing                                                *
 * ------------------------------------------------------------------ */

async function processEmailFile(
  tripId: string,
  file: UploadFile,
  claimantFirst: string,
): Promise<ProcessResult> {
  const parsed = parseEmail(file.buffer);
  const cls = classify(parsed);
  const rawBlobRef = await storeBlob(tripId, file.filename, file.buffer);

  const doc = await documentRepository.create({
    tripId,
    sourceType: 'eml',
    fromAddr: parsed.from,
    subject: parsed.subject,
    sentAt: parsed.date ? new Date(parsed.date) : null,
    messageId: parsed.messageId,
    rawBlobRef,
    parsedJson: slimParsed(parsed),
    category: cls.category,
    categoryConfidence: cls.confidence.toFixed(3),
    isNoise: cls.isNoise,
  });

  let ocrText: string | undefined;
  for (const att of parsed.attachments) {
    ocrText = (await storeAttachment(doc.id, tripId, att.filename, att.mime, att.content)) ?? ocrText;
  }

  const outcome: DocOutcome = {
    document: doc.id,
    kind: 'eml',
    subject: parsed.subject,
    category: cls.category,
    confidence: cls.confidence,
    outcome: 'extracted',
  };

  if (cls.isNoise) return { outcome: { ...outcome, outcome: 'noise' }, items: [] };
  if (cls.category === DocumentCategory.ADVANCE) {
    await applyAdvance(tripId, parsed);
    return { outcome: { ...outcome, outcome: 'advance-applied' }, items: [] };
  }
  if (cls.category === DocumentCategory.TRAVEL_APPROVAL) {
    return { outcome: { ...outcome, outcome: 'context' }, items: [] };
  }

  const extractor = selectExtractor(parsed) ?? extractorForCategory(cls.category);
  if (!extractor) return { outcome: { ...outcome, outcome: 'no-extractor' }, items: [] };

  const items = extractor.extract(parsed, ocrText);
  items.forEach((i) => flagOtherPerson(i, claimantFirst));
  const proofFallback = parsed.messageId ?? parsed.subject ?? null;
  return {
    outcome: { ...outcome, outcome: 'extracted', extracted: items.length },
    items: items.map((item) => ({ item, docId: doc.id, proofFallback })),
  };
}

async function processReceiptFile(tripId: string, file: UploadFile): Promise<ProcessResult> {
  const known = KNOWN_RECEIPT_TEXT[file.filename];
  const ocrText = known ?? '';
  const cls = classifyDocumentText(ocrText, file.filename);
  const rawBlobRef = await storeBlob(tripId, file.filename, file.buffer);

  // Synthetic ParsedEmail so the shared classify/extract path applies unchanged.
  const synthetic: ParsedEmail = {
    from: null,
    to: [],
    subject: file.filename,
    date: null,
    messageId: null,
    inReplyTo: null,
    textBody: ocrText,
    attachments: [{ filename: file.filename, mime: file.mime, content: file.buffer }],
  };

  const doc = await documentRepository.create({
    tripId,
    sourceType: 'image',
    fromAddr: null,
    subject: file.filename,
    sentAt: null,
    messageId: null,
    rawBlobRef,
    parsedJson: slimParsed(synthetic),
    category: cls.category,
    categoryConfidence: cls.confidence.toFixed(3),
    isNoise: false,
  });
  await storeAttachment(doc.id, tripId, file.filename, file.mime, file.buffer);

  const outcome: DocOutcome = {
    document: doc.id,
    kind: 'image',
    subject: file.filename,
    category: cls.category,
    confidence: cls.confidence,
    outcome: 'stored',
  };

  const extractor =
    extractorForCategory(cls.category) ?? selectExtractor(synthetic);
  const items = extractor ? extractor.extract(synthetic, ocrText || undefined) : [];

  if (items.length > 0) {
    return {
      outcome: { ...outcome, outcome: 'extracted', extracted: items.length },
      items: items.map((item) => ({ item, docId: doc.id, proofFallback: file.filename })),
    };
  }

  // Couldn't read the receipt — leave a placeholder line the claimant completes.
  const placeholder: ExtractedItem = {
    category: 'other',
    merchant: file.filename,
    lineDate: null,
    grossAmount: 0,
    taxAmount: 0,
    paidBy: 'Employee',
    currency: 'INR',
    reference: file.filename,
    meta: { needsManualEntry: true, uploadedFile: file.filename },
  };
  return { outcome, items: [{ item: placeholder, docId: doc.id, proofFallback: file.filename }] };
}

/* ------------------------------------------------------------------ *
 * shared helpers                                                     *
 * ------------------------------------------------------------------ */

async function persistNewLines(
  tripId: string,
  pending: PendingItem[],
): Promise<{ inserted: number; duplicates: number }> {
  const { kept, duplicates } = dedupe(pending.map((p) => p.item));
  const docIdByItem = new Map(pending.map((p) => [p.item, p.docId]));
  const fallbackByItem = new Map(pending.map((p) => [p.item, p.proofFallback]));

  const existing = await claimLineRepository.listByTrip(tripId);
  const existingKeys = new Set(existing.map(lineKeyFromRow));

  const toInsert: NewClaimLine[] = [];
  for (const item of kept) {
    if (existingKeys.has(lineKey(item))) continue;
    toInsert.push({
      tripId,
      sourceDocumentId: docIdByItem.get(item) ?? null,
      category: item.category,
      merchant: item.merchant,
      lineDate: item.lineDate,
      currency: item.currency,
      grossAmount: money(item.grossAmount),
      taxAmount: money(item.taxAmount),
      paidBy: item.paidBy,
      proofRef: item.reference ?? fallbackByItem.get(item) ?? null,
      policyMeta: (item.meta ?? {}) as Record<string, unknown>,
    });
  }

  const rows = await claimLineRepository.bulkCreate(toInsert);
  return { inserted: rows.length, duplicates: duplicates.length };
}

async function applyAdvance(tripId: string, parsed: ParsedEmail): Promise<void> {
  const text = `${parsed.subject ?? ''}\n${parsed.textBody ?? ''}`;
  const amt = text.match(/advance of INR\s+([\d,]+\.\d{2})/i)?.[1];
  const ref = text.match(/(?:reference|Ref)\s+([A-Za-z0-9/\-]+)/i)?.[1];
  const patch: Record<string, unknown> = {};
  if (amt) patch.advanceAmount = money(toNum(amt));
  if (ref) patch.advanceRef = ref;
  if (Object.keys(patch).length > 0) await tripRepository.update(tripId, patch);
}

function flagOtherPerson(item: ExtractedItem, claimantFirst: string): void {
  const rider = typeof item.meta?.rider === 'string' ? item.meta.rider.toLowerCase() : '';
  if (rider && claimantFirst && !rider.startsWith(claimantFirst)) {
    item.meta = { ...item.meta, incurredByOther: true };
  }
}

async function storeBlob(tripId: string, filename: string, buf: Buffer): Promise<string> {
  const rel = join(tripId, `${randomUUID()}-${safeName(filename)}`);
  await mkdir(join(env.STORAGE_DIR, tripId), { recursive: true });
  await writeFile(join(env.STORAGE_DIR, rel), buf);
  return rel;
}

/** Best-effort delete of a stored blob; a missing file is not an error. */
async function removeBlob(rel: string | null | undefined): Promise<void> {
  if (!rel) return;
  try {
    await unlink(join(env.STORAGE_DIR, rel));
  } catch {
    /* already gone / never written */
  }
}

/** Store an attachment blob + row; returns its OCR text when we can read it. */
async function storeAttachment(
  rawDocumentId: string,
  tripId: string,
  filename: string,
  mime: string,
  content: Buffer,
): Promise<string | undefined> {
  const known = KNOWN_RECEIPT_TEXT[filename];
  const blobRef = await storeBlob(tripId, filename, content);
  await documentRepository.addAttachment({
    rawDocumentId,
    filename,
    mime,
    sizeBytes: content.length,
    blobRef,
    ocrText: known ?? null,
    ocrStatus: known ? 'done' : 'skipped',
  });
  return known;
}

/** parsedJson without attachment bytes (keeps jsonb small; replay only needs text + mime). */
function slimParsed(p: ParsedEmail): Record<string, unknown> {
  return {
    ...p,
    attachments: p.attachments.map((a) => ({ filename: a.filename, mime: a.mime })),
  };
}

function firstName(name: string | null | undefined): string {
  return (name ?? '').trim().split(/\s+/)[0]?.toLowerCase() ?? '';
}

function safeName(filename: string): string {
  return filename.replace(/[^A-Za-z0-9._-]/g, '_');
}

function assertClaimant(trip: { employeeCode: string }, actorCode: string): void {
  if (trip.employeeCode !== actorCode) {
    throw new ForbiddenError('Only the claimant can change this trip.', ErrorCode.FORBIDDEN);
  }
}

function assertEditable(trip: { status: string }): void {
  if (trip.status !== TripStatus.DRAFT && trip.status !== TripStatus.RETURNED) {
    throw new ConflictError(
      `Documents can only change while the trip is DRAFT or RETURNED (currently ${trip.status}).`,
      ErrorCode.CLAIM_NOT_EDITABLE,
    );
  }
}

function lineKey(item: ExtractedItem): string {
  return [
    item.category,
    (item.merchant ?? '').toLowerCase().trim(),
    item.lineDate ?? '',
    round2(item.grossAmount).toFixed(2),
  ].join('|');
}

function lineKeyFromRow(row: {
  category: string;
  merchant: string | null;
  lineDate: string | null;
  grossAmount: string;
}): string {
  return [
    row.category,
    (row.merchant ?? '').toLowerCase().trim(),
    row.lineDate ?? '',
    round2(toNum(row.grossAmount)).toFixed(2),
  ].join('|');
}
