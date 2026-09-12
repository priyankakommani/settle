import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ErrorCode } from '@settle/shared';
import { env } from '../config/env.js';
import { NotFoundError } from './errors.js';

/** Shared by ingest.service.ts (write/read) and trip.service.ts (cleanup on delete) — kept out of either to avoid a circular import between the two. */

export async function storeBlob(tripId: string, filename: string, buf: Buffer): Promise<string> {
  const rel = join(tripId, `${randomUUID()}-${safeName(filename)}`);
  await mkdir(join(env.STORAGE_DIR, tripId), { recursive: true });
  await writeFile(join(env.STORAGE_DIR, rel), buf);
  return rel;
}

export async function readBlob(rel: string): Promise<Buffer> {
  try {
    return await readFile(join(env.STORAGE_DIR, rel));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new NotFoundError('The stored file is missing.', ErrorCode.NOT_FOUND);
    }
    throw err;
  }
}

/** Best-effort delete of a stored blob; a missing file is not an error. */
export async function removeBlob(rel: string | null | undefined): Promise<void> {
  if (!rel) return;
  try {
    await unlink(join(env.STORAGE_DIR, rel));
  } catch {
    /* already gone / never written */
  }
}

function safeName(filename: string): string {
  return filename.replace(/[^A-Za-z0-9._-]/g, '_');
}
