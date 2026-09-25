import { Hono } from 'hono';
import { currentUser } from '../middleware/current-user.js';
import { analyticsController } from '../controllers/analytics.controller.js';

/** /api/analytics — every signed-in user gets a dashboard scoped to their role. */
export const analyticsRoutes = new Hono()
  .use('*', currentUser)
  .get('/overview', analyticsController.overview);
