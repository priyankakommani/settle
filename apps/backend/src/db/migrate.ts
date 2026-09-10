import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { dbSsl, env } from '../config/env.js';
import { logger } from '../lib/logger.js';

/**
 * Applies everything in ./drizzle. Run via `pnpm db:migrate`.
 * Uses its own single-use connection so it can be run standalone in CI / entrypoint.
 */
async function main() {
  const sql = postgres(env.DATABASE_URL, { max: 1, ssl: dbSsl });
  const dbm = drizzle(sql);
  logger.info('db.migrate.start');
  await migrate(dbm, { migrationsFolder: './drizzle' });
  logger.info('db.migrate.done');
  await sql.end();
}

main().catch((err) => {
  logger.error({ err }, 'db.migrate.failed');
  process.exit(1);
});
