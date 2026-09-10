import { randomUUID } from 'node:crypto';
import { createMiddleware } from 'hono/factory';
import { REQUEST_ID_HEADER } from '../config/constants.js';

/**
 * Assigns a correlation id to every request. Honours an inbound
 * `x-request-id` (from a gateway) or generates one. The id is:
 *   - stored on the context as `requestId`
 *   - echoed on the response header
 *   - included in every error body
 *   - attached to the per-request logger
 */
export const requestId = createMiddleware(async (c, next) => {
  const incoming = c.req.header(REQUEST_ID_HEADER);
  const id = incoming && incoming.length <= 128 ? incoming : randomUUID();
  c.set('requestId', id);
  c.header(REQUEST_ID_HEADER, id);
  await next();
});
