import { Hono } from 'hono';
import { currentUser } from '../middleware/current-user.js';
import { validate } from '../middleware/validate.js';
import { uuidParam } from '../validators/common.validators.js';
import { notificationsController } from '../controllers/notifications.controller.js';

/**
 * /api/notifications — the signed-in user's inbox.
 *  GET  /            recent items + unread count
 *  POST /read-all    mark every unread item read
 *  POST /:id/read    mark one item read
 */
export const notificationRoutes = new Hono()
  .use('*', currentUser)
  .get('/', notificationsController.list)
  .post('/read-all', notificationsController.markAllRead)
  .post('/:id/read', validate('param', uuidParam), notificationsController.markRead);
