/**
 * Domain vocabularies shared by API and UI. Keep these in lockstep with the
 * Postgres enums declared in apps/backend/src/db/schema/enums.ts.
 */

export const EmployeeRole = {
  EMPLOYEE: 'Employee',
  REPORTING_MANAGER: 'Reporting Manager',
  HEAD_OF_DEPARTMENT: 'Head of Department',
  HEAD_OF_DIVISION: 'Head of Division',
  MD: 'MD',
  FINANCE: 'Finance',
  ADMIN: 'Admin',
} as const;
export type EmployeeRoleValue = (typeof EmployeeRole)[keyof typeof EmployeeRole];

/** Analytics scope derived from a role — what slice of data the dashboard shows. */
export const AnalyticsScope = {
  EMPLOYEE: 'employee',
  APPROVER: 'approver',
  FINANCE: 'finance',
  ORG: 'org',
} as const;
export type AnalyticsScopeValue = (typeof AnalyticsScope)[keyof typeof AnalyticsScope];

export const CityTier = {
  TIER_1: 'TIER_1',
  TIER_2: 'TIER_2',
  TIER_3: 'TIER_3',
} as const;
export type CityTierValue = (typeof CityTier)[keyof typeof CityTier];

export const TripStatus = {
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  RETURNED: 'RETURNED',
  REJECTED: 'REJECTED',
  PENDING_FINANCE: 'PENDING_FINANCE',
  VERIFIED: 'VERIFIED',
  PAID: 'PAID',
} as const;
export type TripStatusValue = (typeof TripStatus)[keyof typeof TripStatus];

export const ClaimCategory = {
  LODGING: 'lodging',
  CONVEYANCE: 'conveyance',
  MEAL: 'meal',
  BUSINESS_ENTERTAINMENT: 'business_entertainment',
  OTHER: 'other',
} as const;
export type ClaimCategoryValue = (typeof ClaimCategory)[keyof typeof ClaimCategory];

export const PaidBy = {
  EMPLOYEE: 'Employee',
  COMPANY: 'Company',
} as const;
export type PaidByValue = (typeof PaidBy)[keyof typeof PaidBy];

export const PolicyVerdict = {
  ALLOWED: 'allowed',
  CAPPED: 'capped',
  DISALLOWED: 'disallowed',
  NEEDS_INFO: 'needs_info',
} as const;
export type PolicyVerdictValue = (typeof PolicyVerdict)[keyof typeof PolicyVerdict];

export const ApprovalDecision = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  RETURNED: 'returned',
} as const;
export type ApprovalDecisionValue = (typeof ApprovalDecision)[keyof typeof ApprovalDecision];

export const DocumentCategory = {
  TRAVEL_APPROVAL: 'travel_approval',
  ADVANCE: 'advance',
  FLIGHT: 'flight',
  HOTEL_BOOKING: 'hotel_booking',
  HOTEL_INVOICE: 'hotel_invoice',
  CAB: 'cab',
  MEAL: 'meal',
  BUSINESS_ENTERTAINMENT: 'business_entertainment',
  NOISE: 'noise',
  UNKNOWN: 'unknown',
} as const;
export type DocumentCategoryValue = (typeof DocumentCategory)[keyof typeof DocumentCategory];
