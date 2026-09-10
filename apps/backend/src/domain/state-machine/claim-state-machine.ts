import { TripStatus, type TripStatusValue } from '@settle/shared';

/**
 * PURE. The single definition of which status transitions are legal.
 * Services call `assertTransition(current, action)` before writing a new
 * status; nothing sets `trip.status` ad hoc.
 */

export type ClaimAction =
  | 'submit'
  | 'approve_step'
  | 'all_approved'
  | 'return'
  | 'reject'
  | 'resubmit'
  | 'finance_verify'
  | 'finance_pay';

const TRANSITIONS: Record<ClaimAction, { from: TripStatusValue[]; to: TripStatusValue }> = {
  submit: { from: [TripStatus.DRAFT], to: TripStatus.PENDING_APPROVAL },
  approve_step: { from: [TripStatus.PENDING_APPROVAL], to: TripStatus.PENDING_APPROVAL },
  all_approved: { from: [TripStatus.PENDING_APPROVAL], to: TripStatus.PENDING_FINANCE },
  return: { from: [TripStatus.PENDING_APPROVAL, TripStatus.PENDING_FINANCE], to: TripStatus.RETURNED },
  reject: { from: [TripStatus.PENDING_APPROVAL], to: TripStatus.REJECTED },
  resubmit: { from: [TripStatus.RETURNED], to: TripStatus.PENDING_APPROVAL },
  finance_verify: { from: [TripStatus.PENDING_FINANCE], to: TripStatus.VERIFIED },
  finance_pay: { from: [TripStatus.VERIFIED], to: TripStatus.PAID },
};

export function canTransition(current: TripStatusValue, action: ClaimAction): boolean {
  return TRANSITIONS[action].from.includes(current);
}

export function nextStatus(current: TripStatusValue, action: ClaimAction): TripStatusValue {
  if (!canTransition(current, action)) {
    throw new Error(`Illegal transition: cannot "${action}" from "${current}"`);
  }
  return TRANSITIONS[action].to;
}

export const TERMINAL_STATES: TripStatusValue[] = [TripStatus.REJECTED, TripStatus.PAID];
