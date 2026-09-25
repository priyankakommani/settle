import { TripStatus } from '@settle/shared';
import type { TripDetail } from '../../api/types.js';
import { Icon } from '../../ui/icons.js';
import { cx } from '../../ui/primitives.js';
import { shortDate } from '../../lib/format.js';

type StepState = 'done' | 'current' | 'upcoming';

const STEPS = [
  { key: 'build', label: 'Build claim', icon: Icon.File },
  { key: 'approval', label: 'Approval', icon: Icon.Approvals },
  { key: 'finance', label: 'Finance review', icon: Icon.Wallet },
  { key: 'paid', label: 'Paid', icon: Icon.Banknote },
] as const;

/** Which step is the active one for a given trip status. 4 means "past the last step — fully done". */
function currentStepIndex(status: string): number {
  switch (status) {
    case TripStatus.PENDING_APPROVAL:
      return 1;
    case TripStatus.PENDING_FINANCE:
      return 2;
    // Verified is a checkpoint inside finance review, not its own node —
    // once finance verifies, the only thing left is payout.
    case TripStatus.VERIFIED:
      return 3;
    case TripStatus.PAID:
      return 4;
    default:
      return 0;
  }
}

/** Caption under a step: who/when, not just a static label — mirrors what a reviewer actually needs to know. */
function captionFor(
  stepKey: (typeof STEPS)[number]['key'],
  state: StepState,
  trip: TripDetail['trip'],
  approvals: TripDetail['approvals'],
): string {
  switch (stepKey) {
    case 'build':
      if (state === 'current') return 'You are here';
      return shortDate(trip.createdAt);
    case 'approval': {
      if (state === 'upcoming') return 'Goes for a decision';
      const pending = approvals.find((a) => a.decision === 'pending');
      if (state === 'current') return pending ? `Waiting on ${pending.role}` : 'Waiting on approver';
      const lastDecided = [...approvals].reverse().find((a) => a.decidedAt);
      return lastDecided ? `Approved ${shortDate(lastDecided.decidedAt)}` : 'Approved';
    }
    case 'finance':
      if (state === 'upcoming') return 'Goes to Finance';
      if (state === 'current') return 'Waiting on Finance';
      return 'Verified';
    case 'paid':
      if (state === 'upcoming') return 'Paid & closed';
      if (state === 'current') return 'Awaiting payout';
      return 'Paid';
  }
}

/** Always-visible pipeline status (every tab, not just Overview) — where the claim sits, and who it's waiting on. */
export function TripProgressTracker({
  trip,
  approvals,
}: {
  trip: TripDetail['trip'];
  approvals: TripDetail['approvals'];
}) {
  const isRejected = trip.status === TripStatus.REJECTED;
  const isReturned = trip.status === TripStatus.RETURNED;
  // Rejected/returned aren't points on the forward pipeline — they branch off
  // "Build claim" back to the employee, so the stepper treats them as still there.
  const effectiveStatus = isRejected || isReturned ? TripStatus.DRAFT : trip.status;
  const currentIndex = currentStepIndex(effectiveStatus);

  return (
    <div className="progress-tracker">
      {isReturned && (
        <div className="progress-tracker__alert progress-tracker__alert--warn">
          <Icon.Alert size={14} />
          Sent back for changes — update the claim and resubmit.
        </div>
      )}
      {isRejected && (
        <div className="progress-tracker__alert progress-tracker__alert--danger">
          <Icon.Alert size={14} />
          This claim was rejected.
        </div>
      )}

      <ol className="progress-steps">
        {STEPS.map((step, i) => {
          const state: StepState = i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'upcoming';
          const StepIcon = step.icon;
          return (
            <li key={step.key} className={cx('progress-steps__item', `progress-steps__item--${state}`)}>
              <span className="progress-steps__dot">
                {state === 'done' ? <Icon.Check size={13} /> : <StepIcon size={14} />}
              </span>
              <span className="progress-steps__label">{step.label}</span>
              <span className="progress-steps__caption">{captionFor(step.key, state, trip, approvals)}</span>
              {i < STEPS.length - 1 && <span className="progress-steps__line" />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
