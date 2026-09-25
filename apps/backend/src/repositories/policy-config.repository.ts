import { db } from '../db/index.js';
import { policyConfig, type PolicyConfigRow } from '../db/schema/index.js';
import { mapDbError } from '../lib/db-error.js';

/** Data access for `policy_config` — the runtime source of every tunable number. */
export const policyConfigRepository = {
  async all(): Promise<PolicyConfigRow[]> {
    try {
      return await db.select().from(policyConfig);
    } catch (err) {
      throw mapDbError(err);
    }
  },
};

export type PolicyConfigRepository = typeof policyConfigRepository;
