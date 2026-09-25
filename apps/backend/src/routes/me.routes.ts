import { Hono } from 'hono';
import { currentUser } from '../middleware/current-user.js';
import { meController } from '../controllers/me.controller.js';

/** /api/me — resolve the acting user (auth stub). */
export const meRoutes = new Hono().use('*', currentUser).get('/', meController.get);
