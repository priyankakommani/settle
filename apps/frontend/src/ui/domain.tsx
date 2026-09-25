import {
  PolicyVerdict,
  TripStatus,
  type PolicyVerdictValue,
  type TripStatusValue,
} from '@settle/shared';
import { Badge } from './primitives.js';

/** Trip/claim status -> human label + colour tone. */
const STATUS_META: Record<TripStatusValue, { label: string; tone: 'ok' | 'warn' | 'danger' | 'info' | 'neutral' }> = {
  [TripStatus.DRAFT]: { label: 'Draft', tone: 'neutral' },
  [TripStatus.PENDING_APPROVAL]: { label: 'Pending approval', tone: 'info' },
  [TripStatus.RETURNED]: { label: 'Returned', tone: 'warn' },
  [TripStatus.REJECTED]: { label: 'Rejected', tone: 'danger' },
  [TripStatus.PENDING_FINANCE]: { label: 'With finance', tone: 'info' },
  [TripStatus.VERIFIED]: { label: 'Verified', tone: 'ok' },
  [TripStatus.PAID]: { label: 'Paid', tone: 'ok' },
};

export function StatusPill({ status }: { status: string }) {
  const meta = STATUS_META[status as TripStatusValue] ?? { label: status, tone: 'neutral' as const };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

const VERDICT_META: Record<PolicyVerdictValue, { label: string; tone: 'ok' | 'warn' | 'danger' | 'info' | 'neutral' }> = {
  [PolicyVerdict.ALLOWED]: { label: 'Allowed', tone: 'ok' },
  [PolicyVerdict.CAPPED]: { label: 'Capped', tone: 'warn' },
  [PolicyVerdict.DISALLOWED]: { label: 'Disallowed', tone: 'danger' },
  [PolicyVerdict.NEEDS_INFO]: { label: 'Needs info', tone: 'warn' },
};

export function VerdictTag({ verdict }: { verdict: string | null | undefined }) {
  if (!verdict) return <Badge tone="neutral">Not evaluated</Badge>;
  const meta = VERDICT_META[verdict as PolicyVerdictValue] ?? { label: verdict, tone: 'neutral' as const };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

/** Right-aligned, tabular INR amount. */
export function Money({ value, muted }: { value: number | string | null | undefined; muted?: boolean }) {
  const n = value == null ? 0 : typeof value === 'string' ? Number(value) : value;
  const text = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
  return <span className={muted ? 'u-mono u-subtle' : 'u-mono'}>{text}</span>;
}
