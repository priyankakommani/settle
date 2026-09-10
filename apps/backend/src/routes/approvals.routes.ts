import { Hono } from 'hono';
import { EmployeeRole } from '@settle/shared';
import { currentUser } from '../middleware/current-user.js';
import { requireRole } from '../middleware/require-role.js';
import { validate } from '../middleware/validate.js';
import { decideSchema, levelParam } from '../validators/approval.validators.js';
import { approvalsController } from '../controllers/approvals.controller.js';

/**
 * /api/trips/:id/approvals/:level
 * Only business approvers can hit this; Finance uses /api/finance.
 */
export const approvalRoutes = new Hono()
  .use('*', currentUser)
  .use(
    '*',
    requireRole(
      EmployeeRole.REPORTING_MANAGER,
      EmployeeRole.HEAD_OF_DEPARTMENT,
      EmployeeRole.HEAD_OF_DIVISION,
      EmployeeRole.MD,
    ),
  )
  .post(
    '/:id/approvals/:level',
    validate('param', levelParam),
    validate('json', decideSchema),
    approvalsController.decide,
  );
