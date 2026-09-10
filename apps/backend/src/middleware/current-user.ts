import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import { getCookie } from 'hono/cookie';
import { ErrorCode } from '@settle/shared';
import { UnauthorizedError } from '../lib/errors.js';
import { allowHeaderAuth, env } from '../config/env.js';
import { USER_HEADER } from '../config/constants.js';
import { readSessionToken } from '../lib/session-token.js';
import { employeeRepository } from '../repositories/employee.repository.js';

/**
 * Resolves the acting user and puts the full employee row on the context as
 * `currentUser`. Identity comes, in order, from:
 *
 *   1. the session cookie (JWT)              — the real path
 *   2. `Authorization: Bearer <jwt>`         — API clients / tests
 *   3. `x-user: <empCode>` header            — dev/e2e only (allowHeaderAuth)
 *
 * The token only carries the empCode; the employee is re-loaded every request
 * so role changes / removals take effect immediately.
 */
export const currentUser = createMiddleware(async (c, next) => {
  const empCode = await resolveEmpCode(c);

  const employee = await employeeRepository.findByCode(empCode);
  if (!employee) {
    throw new UnauthorizedError(
      `Session refers to unknown employee "${empCode}".`,
      ErrorCode.USER_NOT_FOUND,
    );
  }

  c.set('currentUser', employee);
  await next();
});

async function resolveEmpCode(c: Context): Promise<string> {
  const cookieToken = getCookie(c, env.SESSION_COOKIE);
  if (cookieToken) {
    return (await readSessionToken(cookieToken)).sub;
  }

  const authHeader = c.req.header('authorization');
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    return (await readSessionToken(authHeader.slice(7).trim())).sub;
  }

  if (allowHeaderAuth) {
    const headerCode = c.req.header(USER_HEADER)?.trim();
    if (headerCode) return headerCode;
  }

  throw new UnauthorizedError('Not signed in.', ErrorCode.AUTH_REQUIRED);
}
