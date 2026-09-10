import { z } from 'zod';
import { CityTier } from '@settle/shared';
import { isoDate } from './common.validators.js';

const amount = z.coerce
  .number({ invalid_type_error: 'Enter a number' })
  .nonnegative('Must be 0 or more')
  .max(100_000_000, 'That amount looks too large')
  .finite();

/**
 * The Travel Request. The employee does NOT supply the Travel Request ID —
 * it is issued by the system on creation (policy 1.1).
 */
export const createTripSchema = z.object({
  purpose: z.string().max(500).optional(),
  originCity: z.string().max(120).optional(),
  destCity: z.string().max(120).optional(),
  destTier: z.enum([CityTier.TIER_1, CityTier.TIER_2, CityTier.TIER_3]).optional(),
  isInternational: z.boolean().optional(),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  /** estimated employee-borne cost declared on the request */
  estimatedCost: amount.optional(),
  /** advance requested (policy 1.2: capped at 60% of estimatedCost) */
  advanceRequested: amount.optional(),
});

export type CreateTripInput = z.infer<typeof createTripSchema>;

export const listTripsQuerySchema = z.object({
  status: z.string().optional(),
});
