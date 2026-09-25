import type { Context } from 'hono';
import { created, noContent, ok } from '../lib/response.js';
import { valid } from '../middleware/validate.js';
import { uuidParam } from '../validators/common.validators.js';
import { addClaimLineSchema, editClaimLineSchema } from '../validators/claim-line.validators.js';
import { claimService } from '../services/claim.service.js';

export const claimLinesController = {
  async add(c: Context) {
    const user = c.get('currentUser');
    const { id } = valid(c, 'param', uuidParam);
    const input = valid(c, 'json', addClaimLineSchema);
    const line = await claimService.addLine(id, user.empCode, input);
    return created(c, line);
  },

  async edit(c: Context) {
    const user = c.get('currentUser');
    const { id } = valid(c, 'param', uuidParam);
    const patch = valid(c, 'json', editClaimLineSchema);
    const line = await claimService.editLine(id, user.empCode, patch);
    return ok(c, line);
  },

  async remove(c: Context) {
    const user = c.get('currentUser');
    const { id } = valid(c, 'param', uuidParam);
    await claimService.removeLine(id, user.empCode);
    return noContent(c);
  },
};
