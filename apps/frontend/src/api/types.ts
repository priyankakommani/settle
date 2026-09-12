import type {
  ApprovalDecisionValue,
  ClaimCategoryValue,
  DocumentCategoryValue,
  EmployeeRoleValue,
  PaidByValue,
  PolicyVerdictValue,
  TripStatusValue,
} from '@settle/shared';

export type AnalyticsUnit = 'inr' | 'count' | 'days' | 'pct';
export type AnalyticsTone = 'ok' | 'warn' | 'danger' | 'accent' | 'neutral';

export interface AnalyticsKpi {
  key: string;
  label: string;
  value: number;
  unit: AnalyticsUnit;
  tone?: AnalyticsTone;
  hint?: string;
}

export interface StatusSlice {
  status: string;
  count: number;
  value: number;
}

export interface MonthPoint {
  month: string;
  claims: number;
  value: number;
  paidClaims: number;
  paidValue: number;
}

export interface CategorySlice {
  category: string;
  allowed: number;
  disallowed: number;
}

export interface DecisionSlice {
  decision: string;
  count: number;
}

export interface SpenderRow {
  employeeCode: string;
  name: string;
  trips: number;
  value: number;
}

export interface ReasonRow {
  reasonCode: string;
  count: number;
  amount: number;
}

export interface AnalyticsOverview {
  scope: 'employee' | 'approver' | 'finance' | 'org';
  generatedAt: string;
  kpis: AnalyticsKpi[];
  statusBreakdown: StatusSlice[];
  monthly: MonthPoint[];
  categoryBreakdown: CategorySlice[];
  decisions?: DecisionSlice[];
  topSpenders?: SpenderRow[];
  disallowReasons?: ReasonRow[];
}

/**
 * Frontend view of the API payloads. These mirror the backend DTOs; they are
 * intentionally permissive (nullable) until the backend "code phase" locks the
 * exact shapes.
 */

export interface Me {
  empCode: string;
  name: string;
  email: string;
  designation: string;
  department: string;
  city: string;
  role: EmployeeRoleValue;
  reportingManagerCode: string | null;
}

export interface TripSummary {
  id: string;
  travelRequestId: string;
  employeeCode: string;
  destCity: string | null;
  startDate: string | null;
  endDate: string | null;
  status: TripStatusValue;
  createdAt: string;
}

export interface TripDocumentAttachment {
  id: string;
  filename: string;
  mime: string;
  sizeBytes: number | null;
  ocrText: string | null;
  ocrStatus: 'pending' | 'done' | 'failed' | 'skipped' | string;
  createdAt: string;
}

export interface TripDocument {
  id: string;
  sourceType: 'eml' | 'image' | 'manual';
  category: DocumentCategoryValue;
  categoryConfidence: string | null;
  subject: string | null;
  fromAddr: string | null;
  messageId: string | null;
  sentAt: string | null;
  createdAt: string;
  isNoise: boolean;
  isDuplicateOf: string | null;
  attachments: TripDocumentAttachment[];
  /** Parsed email/OCR output kept for replay — `textBody` is the body text (or, for a bare image upload, its OCR text). */
  parsedJson: { textBody?: string | null } | null;
}

export interface ClaimLine {
  id: string;
  sourceDocumentId: string | null;
  category: ClaimCategoryValue;
  merchant: string | null;
  description: string | null;
  lineDate: string | null;
  currency: string;
  grossAmount: string;
  taxAmount: string;
  paidBy: PaidByValue;
  policyVerdict: PolicyVerdictValue | null;
  allowedAmount: string;
  disallowedAmount: string;
  reasonText: string | null;
  proofRef: string | null;
  editedByUser: boolean;
  policyMeta: {
    originalExtraction?: {
      category: string;
      merchant: string | null;
      lineDate: string | null;
      currency: string;
      grossAmount: string;
    };
    [key: string]: unknown;
  } | null;
}

export interface Settlement {
  totalEmployeePaid: string;
  totalCompanyPaidMemo: string;
  totalDisallowed: string;
  netReimbursable: string;
  advanceDrawn: string;
  amountPayable: string;
  amountRecoverable: string;
}

export interface ApprovalStep {
  id: string;
  level: number;
  role: EmployeeRoleValue;
  approverCode: string | null;
  decision: ApprovalDecisionValue;
  remarks: string | null;
  decidedAt: string | null;
}

export interface TripDetail {
  trip: TripSummary & {
    purpose: string | null;
    originCity: string | null;
    destTier: string | null;
    estimatedCost: string | null;
    advanceRequested: string | null;
    advanceRef: string | null;
    advanceAmount: string;
  };
  documents: TripDocument[];
  claimLines: ClaimLine[];
  approvals: ApprovalStep[];
  settlement: Settlement | null;
}

export interface QueueRow {
  tripId: string;
  travelRequestId: string;
  employeeName: string;
  destCity: string | null;
  netReimbursable: string | null;
  status: TripStatusValue;
  waitingSince: string | null;
  currentLevel: number | null;
}
