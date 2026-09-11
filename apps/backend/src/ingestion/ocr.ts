import { mkdir } from 'node:fs/promises';
import { createWorker } from 'tesseract.js';
import { env } from '../config/env.js';

/**
 * Real OCR for receipt images, used when a filename isn't one of the
 * pre-transcribed samples in known-receipts.ts. Tesseract only reads raster
 * images — PDFs still fall back to KNOWN_RECEIPT_TEXT / manual entry.
 */
const OCR_MIME_PREFIXES = ['image/'];

export function canOcr(mime: string): boolean {
  return OCR_MIME_PREFIXES.some((p) => mime.startsWith(p));
}

let workerPromise: ReturnType<typeof createWorker> | null = null;

// cachePath pins the ~5MB language-model download to STORAGE_DIR instead of
// tesseract.js's default (the process cwd, which varies by how the server is launched).
async function getWorker() {
  if (!workerPromise) {
    workerPromise = mkdir(env.STORAGE_DIR, { recursive: true }).then(() =>
      createWorker('eng', 1, { cachePath: env.STORAGE_DIR }),
    );
  }
  return workerPromise;
}

/** Recognize text in an image buffer. Returns null (never throws) on failure. */
export async function runOcr(buffer: Buffer, mime: string): Promise<string | null> {
  if (!canOcr(mime)) return null;
  try {
    const worker = await getWorker();
    const {
      data: { text },
    } = await worker.recognize(buffer);
    const trimmed = text.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}
