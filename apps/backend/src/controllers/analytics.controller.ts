import type { Context } from 'hono';
import { ok } from '../lib/response.js';
import { analyticsService } from '../services/analytics.service.js';

export const analyticsController = {
  /** Role-scoped dashboard payload for the signed-in user. */
  async overview(c: Context) {
    const user = c.get('currentUser');
    return ok(c, await analyticsService.overview(user));
  },
};
