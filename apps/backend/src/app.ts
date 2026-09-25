import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { bodyLimit } from 'hono/body-limit';
import { env } from './config/env.js';
import { MAX_UPLOAD_BYTES } from './config/constants.js';
import { requestId } from './middleware/request-id.js';
import { requestLogger } from './middleware/request-logger.js';
import { onError, onNotFound } from './middleware/error-handler.js';
import { PayloadTooLargeError } from './lib/errors.js';
import { api } from './routes/index.js';
import { ok } from './lib/response.js';

/**
 * Assembles the HTTP app. This is the "index" that owns cross-cutting
 * concerns: correlation id, logging, CORS, body size, and — crucially — the
 * single global error handler + 404 handler. No route file repeats any of it.
 *
 * Middleware order matters:
 *   requestId -> requestLogger -> security/cors/bodyLimit -> routes
 * so every log line and every error body carries the request id.
 */
export function createApp() {
  const app = new Hono();

  app.use('*', requestId);
  app.use('*', requestLogger);
  app.use('*', secureHeaders());
  app.use(
    '*',
    cors({
      origin: env.CORS_ORIGINS,
      allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'x-user', 'x-request-id'],
      exposeHeaders: ['x-request-id'],
      credentials: true,
      maxAge: 86400,
    }),
  );
  app.use(
    '/api/*',
    bodyLimit({
      maxSize: MAX_UPLOAD_BYTES,
      onError: () => {
        throw new PayloadTooLargeError(`Upload exceeds ${MAX_UPLOAD_BYTES} bytes.`);
      },
    }),
  );

  // service banner for anyone hitting the bare host — this is an API-only
  // server, so this is the only non-/api route
  app.get('/', (c) =>
    ok(c, { service: 'settle-api', status: 'ok', health: '/api/health/live' }),
  );

  app.route('/api', api);

  // the two global handlers — the only place errors become responses
  app.notFound(onNotFound);
  app.onError(onError);

  return app;
}

export type App = ReturnType<typeof createApp>;
