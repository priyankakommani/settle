import { Hono } from 'hono';
import { EmployeeRole } from '@settle/shared';
import { currentUser } from '../middleware/current-user.js';
import { requireRole } from '../middleware/require-role.js';
import { ok } from '../lib/response.js';
import { queueService } from '../services/queue.service.js';

/**
 * /api/admin — oversight surface for Admin and MD. Read-only: they see every
 * claim and drill into any of them through the normal review screen.
 */
export const adminRoutes = new Hono()
  .use('*', currentUser)
  .use('*', requireRole(EmployeeRole.ADMIN, EmployeeRole.MD))
  .get('/claims', async (c) => ok(c, await queueService.allClaims()));
