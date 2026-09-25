import type { Context } from 'hono';
import { ok } from '../lib/response.js';
import { valid } from '../middleware/validate.js';
import { uuidParam } from '../validators/common.validators.js';
import { financeReturnSchema } from '../validators/approval.validators.js';
import { financeService } from '../services/finance.service.js';

export const financeController = {
  async verify(c: Context) {
    const user = c.get('currentUser');
    const { id } = valid(c, 'param', uuidParam);
    const result = await financeService.verify(id, user.empCode);
    return ok(c, result);
  },

  async returnToEmployee(c: Context) {
    const user = c.get('currentUser');
    const { id } = valid(c, 'param', uuidParam);
    const { remarks } = valid(c, 'json', financeReturnSchema);
    const result = await financeService.returnToEmployee(id, user.empCode, remarks);
    return ok(c, result);
  },

  async pay(c: Context) {
    const user = c.get('currentUser');
    const { id } = valid(c, 'param', uuidParam);
    const result = await financeService.releasePayment(id, user.empCode);
    return ok(c, result);
  },
};
