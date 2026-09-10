import type { ApprovalStep } from '../../api/types.js';
import { cx } from '../../ui/primitives.js';
import { shortDate } from '../../lib/format.js';

const DECISION_LABEL: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  returned: 'Returned',
};

/** The approval chain as a vertical timeline. Current step = first pending. */
export function ApprovalTimeline({ steps }: { steps: ApprovalStep[] }) {
  const firstPending = steps.find((s) => s.decision === 'pending')?.level ?? -1;

  return (
    <div className="timeline">
      {steps.map((step) => {
        const state =
          step.decision === 'approved'
            ? 'done'
            : step.decision === 'rejected' || step.decision === 'returned'
              ? 'rejected'
              : step.level === firstPending
                ? 'current'
                : 'pending';
        return (
          <div className="timeline__item" key={step.id}>
            <div className="timeline__rail">
              <span className={cx('timeline__dot', state !== 'pending' && `timeline__dot--${state}`)} />
              <span className="timeline__line" />
            </div>
            <div>
              <div className="timeline__title">
                {step.role} · {DECISION_LABEL[step.decision] ?? step.decision}
              </div>
              <div className="timeline__meta">
                {step.approverCode ? `${step.approverCode}` : 'Unassigned'}
                {step.decidedAt ? ` · ${shortDate(step.decidedAt)}` : ''}
              </div>
              {step.remarks ? (
                <div className="notice u-mt-2" style={{ fontSize: 'var(--fs-12)' }}>
                  {step.remarks}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
