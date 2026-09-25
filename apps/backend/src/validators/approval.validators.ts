import { z } from 'zod';
import { ApprovalDecision } from '@settle/shared';

export const decideSchema = z
  .object({
    decision: z.enum([
      ApprovalDecision.APPROVED,
      ApprovalDecision.REJECTED,
      ApprovalDecision.RETURNED,
    ]),
    remarks: z.string().max(1000).optional(),
  })
  .refine((v) => v.decision === ApprovalDecision.APPROVED || !!v.remarks, {
    message: 'remarks are required when rejecting or returning',
    path: ['remarks'],
  });
export type DecideInput = z.infer<typeof decideSchema>;

export const levelParam = z.object({
  id: z.string().uuid(),
  level: z.coerce.number().int().positive(),
});

export const financeReturnSchema = z.object({
  remarks: z.string().min(1).max(1000),
});
