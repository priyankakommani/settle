import type { Context } from 'hono';
import { ok } from '../lib/response.js';
import { valid } from '../middleware/validate.js';
import { decideSchema, levelParam } from '../validators/approval.validators.js';
import { approvalService } from '../services/approval.service.js';

export const approvalsController = {
  async decide(c: Context) {
    const user = c.get('currentUser');
    const { id, level } = valid(c, 'param', levelParam);
    const { decision, remarks } = valid(c, 'json', decideSchema);
    const result = await approvalService.decide(id, level, user.empCode, decision, remarks);
    return ok(c, result);
  },
};
