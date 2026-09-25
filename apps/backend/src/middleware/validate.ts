import type { Context } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { z, ZodSchema } from 'zod';
import { ValidationError } from '../lib/errors.js';

type Target = 'json' | 'query' | 'param' | 'header' | 'form';

/**
 * Thin wrapper around @hono/zod-validator that routes every failure through
 * our `ValidationError` (HTTP 422, code VALIDATION_ERROR) with a flattened,
 * field-keyed `details` payload — so the client always sees the same shape.
 *
 *   const body = c.req.valid('json');   // fully typed, already validated
 */
export function validate<T extends ZodSchema>(target: Target, schema: T) {
  return zValidator(target, schema, (result, _c: Context) => {
    if (!result.success) {
      throw new ValidationError('Request validation failed', {
        target,
        issues: result.error.flatten(),
      });
    }
  });
}

/**
 * Typed accessor for data already validated by `validate(target, schema)`.
 * Splitting routes from controllers means `c.req.valid()` loses its inferred
 * type; this recovers it with one explicit, contained cast.
 *
 *   const input = valid(c, 'json', createTripSchema);
 */
export function valid<T extends ZodSchema>(c: Context, target: Target, _schema: T): z.infer<T> {
  return (c.req as unknown as { valid(t: Target): z.infer<T> }).valid(target);
}
