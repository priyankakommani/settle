import { z } from 'zod';

export const uuidParam = z.object({ id: z.string().uuid('must be a UUID') });

export const tripDocParam = z.object({
  id: z.string().uuid('must be a UUID'),
  docId: z.string().uuid('must be a UUID'),
});

export const tripAttachmentParam = z.object({
  id: z.string().uuid('must be a UUID'),
  attachmentId: z.string().uuid('must be a UUID'),
});

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');

export const money = z
  .number({ invalid_type_error: 'expected a number' })
  .nonnegative('must be >= 0')
  .finite();
