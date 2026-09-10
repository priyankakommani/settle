import { Hono } from 'hono';
import { EmployeeRole } from '@settle/shared';
import { currentUser } from '../middleware/current-user.js';
import { requireRole } from '../middleware/require-role.js';
import { validate } from '../middleware/validate.js';
import { uuidParam } from '../validators/common.validators.js';
import { financeReturnSchema } from '../validators/approval.validators.js';
import { financeController } from '../controllers/finance.controller.js';

/**
 * /api/finance/trips/:id/...
 * Finance-only. Verification is required on every claim after business
 * approvals (policy 2.1).
 */
export const financeRoutes = new Hono()
  .use('*', currentUser)
  .use('*', requireRole(EmployeeRole.FINANCE))
  .post('/trips/:id/verify', validate('param', uuidParam), financeController.verify)
  .post(
    '/trips/:id/return',
    validate('param', uuidParam),
    validate('json', financeReturnSchema),
    financeController.returnToEmployee,
  )
  .post('/trips/:id/pay', validate('param', uuidParam), financeController.pay);
