import type { Context } from 'hono';
import { created, ok } from '../lib/response.js';
import { valid } from '../middleware/validate.js';
import { uuidParam, tripDocParam, tripAttachmentParam } from '../validators/common.validators.js';
import { createTripSchema, updateTripSchema } from '../validators/trip.validators.js';
import { tripService } from '../services/trip.service.js';
import { ingestService } from '../services/ingest.service.js';
import { claimService } from '../services/claim.service.js';

export const tripsController = {
  async listMine(c: Context) {
    const user = c.get('currentUser');
    const trips = await tripService.listForEmployee(user.empCode);
    return ok(c, trips);
  },

  async create(c: Context) {
    const user = c.get('currentUser');
    const input = valid(c, 'json', createTripSchema);
    const trip = await tripService.createForEmployee(user.empCode, input);
    return created(c, trip);
  },

  async getOne(c: Context) {
    const user = c.get('currentUser');
    const { id } = valid(c, 'param', uuidParam);
    const detail = await tripService.getDetailForViewer(id, user);
    return ok(c, detail);
  },

  async update(c: Context) {
    const user = c.get('currentUser');
    const { id } = valid(c, 'param', uuidParam);
    const input = valid(c, 'json', updateTripSchema);
    await tripService.updateForEmployee(id, user.empCode, input);
    return ok(c, await tripService.getDetail(id));
  },

  async remove(c: Context) {
    const user = c.get('currentUser');
    const { id } = valid(c, 'param', uuidParam);
    await tripService.deleteForEmployee(id, user.empCode);
    return ok(c, { removed: id });
  },

  async ingest(c: Context) {
    const user = c.get('currentUser');
    const { id } = valid(c, 'param', uuidParam);
    const body = await c.req.parseBody({ all: true });
    const files = await collectFiles(body);
    const result = await ingestService.ingestUpload(id, user.empCode, files);
    return ok(c, result);
  },

  async reprocess(c: Context) {
    const user = c.get('currentUser');
    const { id } = valid(c, 'param', uuidParam);
    await ingestService.reprocess(id, user.empCode);
    return ok(c, await tripService.getDetail(id));
  },

  async removeDocument(c: Context) {
    const user = c.get('currentUser');
    const { id, docId } = valid(c, 'param', tripDocParam);
    await ingestService.removeDocument(id, docId, user.empCode);
    return ok(c, await tripService.getDetail(id));
  },

  /** Streams back the original uploaded file (raw .eml, or the raw image/PDF as uploaded). */
  async downloadDocument(c: Context) {
    const user = c.get('currentUser');
    const { id, docId } = valid(c, 'param', tripDocParam);
    const file = await ingestService.getDocumentFile(id, docId, user);
    return fileResponse(c, file);
  },

  /** Streams back one attachment's original bytes (e.g. an image embedded in an .eml). */
  async downloadAttachment(c: Context) {
    const user = c.get('currentUser');
    const { id, attachmentId } = valid(c, 'param', tripAttachmentParam);
    const file = await ingestService.getAttachmentFile(id, attachmentId, user);
    return fileResponse(c, file);
  },

  async recompute(c: Context) {
    const user = c.get('currentUser');
    const { id } = valid(c, 'param', uuidParam);
    await claimService.recompute(id, user.empCode);
    return ok(c, await tripService.getDetail(id));
  },

  async submit(c: Context) {
    const user = c.get('currentUser');
    const { id } = valid(c, 'param', uuidParam);
    const result = await claimService.submit(id, user.empCode);
    return ok(c, result);
  },
};

/** Send a stored file back inline (viewable in-browser rather than forced download). */
function fileResponse(c: Context, file: { filename: string; mime: string; buffer: Buffer }) {
  c.header('Content-Type', file.mime);
  c.header('Content-Disposition', `inline; filename="${encodeURIComponent(file.filename)}"`);
  return c.body(new Uint8Array(file.buffer));
}

/** Flatten a multipart body into buffers for the ingestion service. */
async function collectFiles(
  body: Record<string, unknown>,
): Promise<{ filename: string; buffer: Buffer; mime: string }[]> {
  const out: { filename: string; buffer: Buffer; mime: string }[] = [];
  for (const value of Object.values(body)) {
    const items = Array.isArray(value) ? value : [value];
    for (const item of items) {
      if (item instanceof File) {
        out.push({
          filename: item.name,
          mime: item.type || 'application/octet-stream',
          buffer: Buffer.from(await item.arrayBuffer()),
        });
      }
    }
  }
  return out;
}
