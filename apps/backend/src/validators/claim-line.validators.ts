import { z } from 'zod';
import { ClaimCategory, PaidBy } from '@settle/shared';
import { isoDate, money } from './common.validators.js';

const category = z.enum([
  ClaimCategory.LODGING,
  ClaimCategory.CONVEYANCE,
  ClaimCategory.MEAL,
  ClaimCategory.BUSINESS_ENTERTAINMENT,
  ClaimCategory.OTHER,
]);

const paidBy = z.enum([PaidBy.EMPLOYEE, PaidBy.COMPANY]);

export const addClaimLineSchema = z.object({
  category,
  merchant: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
  lineDate: isoDate.optional(),
  currency: z.string().length(3).default('INR'),
  grossAmount: money,
  taxAmount: money.default(0),
  paidBy: paidBy.default(PaidBy.EMPLOYEE),
  sourceDocumentId: z.string().uuid().optional(),
  proofRef: z.string().max(300).optional(),
  meta: z.record(z.unknown()).optional(),
});
export type AddClaimLineInput = z.infer<typeof addClaimLineSchema>;

export const editClaimLineSchema = addClaimLineSchema.partial();
export type EditClaimLineInput = z.infer<typeof editClaimLineSchema>;
