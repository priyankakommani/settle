import { createMiddleware } from 'hono/factory';
import { ErrorCode, type EmployeeRoleValue } from '@settle/shared';
import { ForbiddenError } from '../lib/errors.js';

/**
 * Route guard. Must run AFTER `currentUser`.
 *
 *   app.post('/finance/:id/verify', currentUser, requireRole('Finance'), ...)
 */
export function requireRole(...allowed: EmployeeRoleValue[]) {
  return createMiddleware(async (c, next) => {
    const user = c.get('currentUser');
    if (!user) {
      // programmer error: guard mounted without currentUser
      throw new ForbiddenError('User context not initialised.', ErrorCode.FORBIDDEN);
    }
    if (!allowed.includes(user.role as EmployeeRoleValue)) {
      throw new ForbiddenError(
        `Role "${user.role}" cannot perform this action. Requires one of: ${allowed.join(', ')}.`,
        ErrorCode.ROLE_NOT_PERMITTED,
        { required: allowed, actual: user.role },
      );
    }
    await next();
  });
}
