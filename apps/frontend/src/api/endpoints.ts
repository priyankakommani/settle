import { request } from './client.js';
import type {
  ClaimLine,
  AnalyticsOverview,
  Me,
  QueueRow,
  TripDetail,
  TripSummary,
} from './types.js';

/** Grouped API calls. Screens import from here, never call `request` directly. */

export interface Credentials {
  email: string;
  password: string;
}
export interface AuthPayload {
  user: Me;
  token: string;
}

export const authApi = {
  me: () => request<Me>('/auth/me'),
  login: (body: Credentials) => request<AuthPayload>('/auth/login', { method: 'POST', body }),
  signup: (body: Credentials) => request<AuthPayload>('/auth/signup', { method: 'POST', body }),
  logout: () => request<{ ok: true }>('/auth/logout', { method: 'POST' }),
};

export interface CreateTripBody {
  purpose?: string;
  originCity?: string;
  destCity?: string;
  destTier?: string;
  startDate?: string;
  endDate?: string;
  estimatedCost?: number;
  advanceRequested?: number;
}

export interface ClaimLineBody {
  category: string;
  merchant?: string;
  description?: string;
  lineDate?: string;
  currency?: string;
  grossAmount: number;
  taxAmount?: number;
  paidBy?: string;
  proofRef?: string;
}

export interface IngestResult {
  documents: { document: string; subject: string | null; category: string; outcome: string; extracted?: number }[];
  insertedLines: number;
  duplicatesDropped: number;
}

export const tripsApi = {
  listMine: () => request<TripSummary[]>('/trips'),
  get: (id: string) => request<TripDetail>(`/trips/${id}`),
  create: (body: CreateTripBody) => request<TripSummary>('/trips', { method: 'POST', body }),
  ingest: (id: string, form: FormData) =>
    request<IngestResult>(`/trips/${id}/documents`, { method: 'POST', form }),
  removeDocument: (id: string, docId: string) =>
    request<{ removed: string }>(`/trips/${id}/documents/${docId}`, { method: 'DELETE' }),
  reprocess: (id: string) => request<TripDetail>(`/trips/${id}/reprocess`, { method: 'POST' }),
  recompute: (id: string) => request<TripDetail>(`/trips/${id}/recompute`, { method: 'POST' }),
  submit: (id: string) => request<TripDetail>(`/trips/${id}/submit`, { method: 'POST' }),
  addLine: (id: string, body: ClaimLineBody) =>
    request<ClaimLine>(`/trips/${id}/claim-lines`, { method: 'POST', body }),
};

export const claimLinesApi = {
  update: (lineId: string, body: Partial<ClaimLineBody>) =>
    request<ClaimLine>(`/claim-lines/${lineId}`, { method: 'PATCH', body }),
  remove: (lineId: string) => request<void>(`/claim-lines/${lineId}`, { method: 'DELETE' }),
};

export type ApprovalDecisionBody = {
  decision: 'approved' | 'rejected' | 'returned';
  remarks?: string;
};

export const approvalsApi = {
  queue: () => request<QueueRow[]>('/queues/approvals'),
  decide: (tripId: string, level: number, body: ApprovalDecisionBody) =>
    request<TripDetail>(`/trips/${tripId}/approvals/${level}`, { method: 'POST', body }),
};

export const financeApi = {
  queue: () => request<QueueRow[]>('/queues/finance'),
  verify: (tripId: string) =>
    request<TripDetail>(`/finance/trips/${tripId}/verify`, { method: 'POST' }),
  returnToEmployee: (tripId: string, remarks: string) =>
    request<TripDetail>(`/finance/trips/${tripId}/return`, { method: 'POST', body: { remarks } }),
  pay: (tripId: string) => request<TripDetail>(`/finance/trips/${tripId}/pay`, { method: 'POST' }),
};

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  tripId: string | null;
  read: boolean;
  createdAt: string;
}
export interface NotificationList {
  items: AppNotification[];
  unreadCount: number;
}

export const notificationsApi = {
  list: () => request<NotificationList>('/notifications'),
  markRead: (id: string) => request<{ ok: true }>(`/notifications/${id}/read`, { method: 'POST' }),
  markAllRead: () => request<{ marked: number }>('/notifications/read-all', { method: 'POST' }),
};

/** Personal, work-queue, finance, or organisation analytics based on the signed-in role. */
export const analyticsApi = {
  overview: () => request<AnalyticsOverview>('/analytics/overview'),
};

/** Read-only cross-organisation claim register for Admin and MD oversight. */
export const adminApi = {
  claims: () => request<QueueRow[]>('/admin/claims'),
};
