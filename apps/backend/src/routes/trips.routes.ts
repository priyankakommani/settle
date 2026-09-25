import { Hono } from 'hono';
import { currentUser } from '../middleware/current-user.js';
import { validate } from '../middleware/validate.js';
import { uuidParam, tripDocParam, tripAttachmentParam } from '../validators/common.validators.js';
import { createTripSchema, updateTripSchema } from '../validators/trip.validators.js';
import { tripsController } from '../controllers/trips.controller.js';
import { claimLinesController } from '../controllers/claim-lines.controller.js';
import { addClaimLineSchema } from '../validators/claim-line.validators.js';

/**
 * /api/trips
 * Every route here requires an identity (currentUser). Ownership / role
 * checks that depend on the resource live in the service layer.
 */
export const tripRoutes = new Hono()
  .use('*', currentUser)
  .get('/', tripsController.listMine)
  .post('/', validate('json', createTripSchema), tripsController.create)
  .get('/:id', validate('param', uuidParam), tripsController.getOne)
  .patch(
    '/:id',
    validate('param', uuidParam),
    validate('json', updateTripSchema),
    tripsController.update,
  )
  .delete('/:id', validate('param', uuidParam), tripsController.remove)
  .post('/:id/documents', validate('param', uuidParam), tripsController.ingest)
  .get(
    '/:id/documents/:docId/raw',
    validate('param', tripDocParam),
    tripsController.downloadDocument,
  )
  .get(
    '/:id/attachments/:attachmentId/raw',
    validate('param', tripAttachmentParam),
    tripsController.downloadAttachment,
  )
  .delete(
    '/:id/documents/:docId',
    validate('param', tripDocParam),
    tripsController.removeDocument,
  )
  .post('/:id/reprocess', validate('param', uuidParam), tripsController.reprocess)
  .post('/:id/recompute', validate('param', uuidParam), tripsController.recompute)
  .post('/:id/submit', validate('param', uuidParam), tripsController.submit)
  // nested: claim lines belong to a trip
  .post(
    '/:id/claim-lines',
    validate('param', uuidParam),
    validate('json', addClaimLineSchema),
    claimLinesController.add,
  );
