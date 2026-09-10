import { pgTable, uuid, text, numeric, timestamp, unique } from 'drizzle-orm/pg-core';
import { cityTierEnum } from './enums.js';

/**
 * Every tunable policy number lives here, NOT in code:
 *   lodging_cap_per_night, meal_cap_per_day, be_preapproval_threshold,
 *   advance_max_pct, submission_window_days, ...
 *
 * `cityTier` is null for tier-independent values.
 */
export const policyConfig = pgTable(
  'policy_config',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: text('key').notNull(),
    cityTier: cityTierEnum('city_tier'),
    value: numeric('value', { precision: 14, scale: 2 }).notNull(),
    unit: text('unit'),
    note: text('note'),
    effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    keyTierUnique: unique('policy_config_key_tier_uq').on(t.key, t.cityTier),
  }),
);

export type PolicyConfigRow = typeof policyConfig.$inferSelect;
export type NewPolicyConfigRow = typeof policyConfig.$inferInsert;
