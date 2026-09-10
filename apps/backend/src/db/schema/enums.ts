import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * Postgres enum types. Keep the string values identical to the vocab in
 * @settle/shared/domain-enums.ts.
 */

export const employeeRoleEnum = pgEnum('employee_role', [
  'Employee',
  'Reporting Manager',
  'Head of Department',
  'Head of Division',
  'MD',
  'Finance',
  'Admin',
]);

export const cityTierEnum = pgEnum('city_tier', ['TIER_1', 'TIER_2', 'TIER_3']);

export const tripStatusEnum = pgEnum('trip_status', [
  'DRAFT',
  'PENDING_APPROVAL',
  'RETURNED',
  'REJECTED',
  'PENDING_FINANCE',
  'VERIFIED',
  'PAID',
]);

export const documentSourceEnum = pgEnum('document_source', ['eml', 'image', 'manual']);

export const documentCategoryEnum = pgEnum('document_category', [
  'travel_approval',
  'advance',
  'flight',
  'hotel_booking',
  'hotel_invoice',
  'cab',
  'meal',
  'business_entertainment',
  'noise',
  'unknown',
]);

export const claimCategoryEnum = pgEnum('claim_category', [
  'lodging',
  'conveyance',
  'meal',
  'business_entertainment',
  'other',
]);

export const paidByEnum = pgEnum('paid_by', ['Employee', 'Company']);

export const policyVerdictEnum = pgEnum('policy_verdict', [
  'allowed',
  'capped',
  'disallowed',
  'needs_info',
]);

export const approvalDecisionEnum = pgEnum('approval_decision', [
  'pending',
  'approved',
  'rejected',
  'returned',
]);
