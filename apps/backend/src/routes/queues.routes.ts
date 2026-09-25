import { Hono } from 'hono';
import { EmployeeRole } from '@settle/shared';
import { currentUser } from '../middleware/current-user.js';
import { requireRole } from '../middleware/require-role.js';
import { queuesController } from '../controllers/queues.controller.js';

/** /api/queues — work lists for approvers and finance. */
export const queueRoutes = new Hono()
  .use('*', currentUser)
  .get(
    '/approvals',
    requireRole(
      EmployeeRole.REPORTING_MANAGER,
      EmployeeRole.HEAD_OF_DEPARTMENT,
      EmployeeRole.HEAD_OF_DIVISION,
      EmployeeRole.MD,
    ),
    queuesController.approvals,
  )
  .get('/finance', requireRole(EmployeeRole.FINANCE), queuesController.finance);
