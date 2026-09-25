import { z } from 'zod';
import { CityTier } from '@settle/shared';
import { isoDate } from './common.validators.js';

const amount = z.coerce
  .number({ invalid_type_error: 'Enter a number' })
  .nonnegative('Must be 0 or more')
  .max(100_000_000, 'That amount looks too large')
  .finite();

/** A city name — letters, spaces, and the odd hyphen/apostrophe/period. No digits, no "@". */
const cityName = z
  .string()
  .trim()
  .max(120)
  .regex(/^[A-Za-z][A-Za-z\s.'-]*$/, 'Enter a city name');

/**
 * The Travel Request. The employee does NOT supply the Travel Request ID —
 * it is issued by the system on creation (policy 1.1).
 *
 * The fields below are what makes a request a request — purpose, route,
 * dates, and an estimate. None of them are optional: an empty form must not
 * be able to raise a travel request. `advanceRequested` stays optional since
 * not every trip needs an advance.
 */
export const createTripSchema = z
  .object({
    purpose: z.string().trim().min(1, 'Enter the purpose of travel').max(500),
    originCity: cityName,
    destCity: cityName,
    destTier: z.enum([CityTier.TIER_1, CityTier.TIER_2, CityTier.TIER_3]),
    isInternational: z.boolean().optional(),
    startDate: isoDate,
    endDate: isoDate,
    /** estimated employee-borne cost declared on the request */
    estimatedCost: amount,
    /** advance requested (policy 1.2: capped at 60% of estimatedCost) */
    advanceRequested: amount.optional(),
  })
  .refine((v) => v.originCity !== v.destCity, {
    message: 'From city and destination city cannot be the same',
    path: ['destCity'],
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: 'End date cannot be before start date',
    path: ['endDate'],
  })
  .refine(
    (v) => v.advanceRequested == null || v.advanceRequested <= v.estimatedCost * 0.6 + 0.005,
    {
      message: 'The advance requested cannot exceed 60% of the estimated cost (policy 1.2)',
      path: ['advanceRequested'],
    },
  );

export type CreateTripInput = z.infer<typeof createTripSchema>;

/** Same shape as create — the edit form resends the whole trip request, not a partial patch. */
export const updateTripSchema = createTripSchema;
export type UpdateTripInput = z.infer<typeof updateTripSchema>;

export const listTripsQuerySchema = z.object({
  status: z.string().optional(),
});
