import { Hono } from 'hono';
import { healthController } from '../controllers/health.controller.js';

export const healthRoutes = new Hono()
  .get('/live', healthController.live)
  .get('/ready', healthController.ready);
