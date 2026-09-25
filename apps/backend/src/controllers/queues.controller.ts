import type { Context } from 'hono';
import { ok } from '../lib/response.js';
import { queueService } from '../services/queue.service.js';

export const queuesController = {
  async approvals(c: Context) {
    const user = c.get('currentUser');
    const rows = await queueService.pendingApprovalsFor(user.empCode);
    return ok(c, rows);
  },

  async finance(c: Context) {
    const rows = await queueService.pendingFinance();
    return ok(c, rows);
  },
};
