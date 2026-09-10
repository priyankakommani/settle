import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { dbSsl, env, isTest } from '../config/env.js';
import { logger } from '../lib/logger.js';
import * as schema from './schema/index.js';

/**
 * Single shared connection pool + drizzle instance.
 * Import `{ db }` anywhere in the data layer; never construct another client.
 */
const queryClient = postgres(env.DATABASE_URL, {
  max: isTest ? 1 : 10,
  ssl: dbSsl,
  onnotice: (n) => logger.debug({ notice: n }, 'pg.notice'),
});

export const db = drizzle(queryClient, { schema, logger: false });

export type Db = typeof db;
export { schema };

/** graceful shutdown hook, called from index.ts */
export async function closeDb(): Promise<void> {
  await queryClient.end({ timeout: 5 });
}

/** cheap connectivity probe for the health route */
export async function pingDb(): Promise<boolean> {
  try {
    await queryClient`select 1`;
    return true;
  } catch (err) {
    logger.warn(
      { code: (err as { code?: string }).code ?? 'UNKNOWN' },
      'db.ping.failed — is Postgres up? (pnpm db:up)',
    );
    return false;
  }
}
