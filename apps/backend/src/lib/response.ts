import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { HttpStatus, type ApiSuccess } from '@settle/shared';

/**
 * The only helpers a controller should use to send a body.
 * Guarantees every success response has the same envelope shape.
 */

export function ok<T>(c: Context, data: T, meta?: Record<string, unknown>) {
  return json(c, HttpStatus.OK, data, meta);
}

export function created<T>(c: Context, data: T, meta?: Record<string, unknown>) {
  return json(c, HttpStatus.CREATED, data, meta);
}

export function accepted<T>(c: Context, data: T, meta?: Record<string, unknown>) {
  return json(c, HttpStatus.ACCEPTED, data, meta);
}

export function noContent(c: Context) {
  return c.body(null, HttpStatus.NO_CONTENT);
}

function json<T>(
  c: Context,
  status: ContentfulStatusCode,
  data: T,
  meta?: Record<string, unknown>,
) {
  const body: ApiSuccess<T> = meta ? { success: true, data, meta } : { success: true, data };
  return c.json(body, status);
}
