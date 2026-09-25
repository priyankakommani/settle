import { Hono } from 'hono';
import { currentUser } from '../middleware/current-user.js';
import { validate } from '../middleware/validate.js';
import { uuidParam } from '../validators/common.validators.js';
import { editClaimLineSchema } from '../validators/claim-line.validators.js';
import { claimLinesController } from '../controllers/claim-lines.controller.js';

/**
 * /api/claim-lines/:id  — operations on an existing line by its own id.
 * (Creation is nested under /api/trips/:id/claim-lines.)
 */
export const claimLineRoutes = new Hono()
  .use('*', currentUser)
  .patch(
    '/:id',
    validate('param', uuidParam),
    validate('json', editClaimLineSchema),
    claimLinesController.edit,
  )
  .delete('/:id', validate('param', uuidParam), claimLinesController.remove);
