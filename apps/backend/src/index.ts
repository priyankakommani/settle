import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { closeDb, pingDb } from './db/index.js';

/**
 * Process entrypoint. Boots the HTTP server, verifies the DB is reachable,
 * and wires graceful shutdown. Unhandled failures are logged here as a last
 * resort — everything inside a request is already handled by app.onError.
 */
async function main() {
  const app = createApp();

  const dbUp = await pingDb();
  if (!dbUp) {
    logger.warn('Starting with database unreachable — /api/health/ready will report not-ready.');
  }

  const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
    logger.info(`settle-api listening on http://localhost:${info.port} (${env.NODE_ENV})`);
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'shutdown.start');
    server.close();
    await closeDb();
    logger.info('shutdown.done');
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'unhandledRejection');
  });
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'uncaughtException — exiting');
    process.exit(1);
  });
}

void main();
