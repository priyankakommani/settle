import { Hono } from 'hono';
import { healthRoutes } from './health.routes.js';
import { authRoutes } from './auth.routes.js';
import { meRoutes } from './me.routes.js';
import { tripRoutes } from './trips.routes.js';
import { claimLineRoutes } from './claim-lines.routes.js';
import { approvalRoutes } from './approvals.routes.js';
import { financeRoutes } from './finance.routes.js';
import { queueRoutes } from './queues.routes.js';
import { notificationRoutes } from './notifications.routes.js';
import { analyticsRoutes } from './analytics.routes.js';
import { adminRoutes } from './admin.routes.js';

/**
 * The API router. Mounted at /api by app.ts.
 * Route groups are one file each — no group defines its own error handling;
 * that is global (see middleware/error-handler.ts).
 */
export const api = new Hono()
  .route('/health', healthRoutes)
  .route('/auth', authRoutes)
  .route('/me', meRoutes)
  .route('/trips', tripRoutes)
  .route('/trips', approvalRoutes) // POST /trips/:id/approvals/:level
  .route('/claim-lines', claimLineRoutes)
  .route('/finance', financeRoutes)
  .route('/queues', queueRoutes)
  .route('/notifications', notificationRoutes)
  .route('/analytics', analyticsRoutes)
  .route('/admin', adminRoutes);

export type Api = typeof api;
