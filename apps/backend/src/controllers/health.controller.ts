import type { Context } from 'hono';
import { ok } from '../lib/response.js';
import { pingDb } from '../db/index.js';
import { ServiceUnavailableError } from '../lib/errors.js';

/**
 * Controllers are thin: parse validated input -> call a service -> send a
 * response envelope. They never build error bodies; services throw AppError
 * and the central handler formats it.
 */
export const healthController = {
  live(c: Context) {
    return ok(c, { status: 'ok', uptimeSec: Math.round(process.uptime()) });
  },

  async ready(c: Context) {
    const dbUp = await pingDb();
    if (!dbUp) throw new ServiceUnavailableError('Database not reachable');
    return ok(c, { status: 'ready', db: 'up' });
  },
};
