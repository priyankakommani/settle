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
  // Small managed Postgres instances (e.g. Render's free tier) cap total
  // connections around ~20 and are shared with migrate jobs / studio, so keep
  // the pool conservative. Override with DB_POOL_MAX if a bigger instance is used.
  max: isTest ? 1 : env.DB_POOL_MAX,
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
