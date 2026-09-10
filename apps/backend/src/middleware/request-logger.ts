import { createMiddleware } from 'hono/factory';
import { logger } from '../lib/logger.js';

/**
 * Structured access log + a per-request child logger on the context.
 * Controllers/services use `c.get('logger')` so every line carries the
 * request id automatically.
 */
export const requestLogger = createMiddleware(async (c, next) => {
  const start = performance.now();
  const reqLog = logger.child({ requestId: c.get('requestId') });
  c.set('logger', reqLog);

  await next();

  const ms = Math.round(performance.now() - start);
  reqLog.info(
    {
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs: ms,
    },
    'request.completed',
  );
});
