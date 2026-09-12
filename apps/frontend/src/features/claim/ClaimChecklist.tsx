import { PolicyVerdict } from '@settle/shared';
import type { TripDetail } from '../../api/types.js';
import { deriveDocStatus } from './docStatus.js';
import { Icon } from '../../ui/icons.js';
import { cx } from '../../ui/primitives.js';

type CheckState = 'done' | 'warn' | 'pending';

/**
 * What's done building this claim so far — lives on the Documents tab since
 * it's a documents/claim-lines readout. Each item reflects actual
 * completeness, not just "count > 0": a document that failed to produce a
 * claim line turns its item amber instead of green.
 */
export function ClaimChecklist({
  documents,
  claimLines,
  settlement,
}: {
  documents: TripDetail['documents'];
  claimLines: TripDetail['claimLines'];
  settlement: TripDetail['settlement'];
}) {
  const docsNeedingAttention = documents.filter(
    (d) => deriveDocStatus(d, claimLines, documents).tone === 'warn',
  ).length;
  const linesNeedingInfo = claimLines.filter((l) => l.policyVerdict === PolicyVerdict.NEEDS_INFO).length;

  const docsState: CheckState = documents.length === 0 ? 'pending' : 'done';
  const linesState: CheckState =
    documents.length === 0
      ? 'pending'
      : docsNeedingAttention > 0
        ? 'warn'
        : claimLines.length > 0
          ? 'done'
          : 'pending';
  const policyState: CheckState = settlement == null ? 'pending' : linesNeedingInfo > 0 ? 'warn' : 'done';

  return (
    <ul className="progress-checklist">
      <ChecklistItem
        state={docsState}
        label={documents.length > 0 ? `Documents uploaded (${documents.length})` : 'Documents uploaded'}
      />
      <ChecklistItem
        state={linesState}
        label={
          linesState === 'warn'
            ? `Claim lines built (${claimLines.length}) · ${docsNeedingAttention} need${docsNeedingAttention === 1 ? 's' : ''} a closer look`
            : claimLines.length > 0
              ? `Claim lines built (${claimLines.length})`
              : 'Claim lines built'
        }
      />
      <ChecklistItem
        state={policyState}
        label={policyState === 'warn' ? `Policy checked · ${linesNeedingInfo} need${linesNeedingInfo === 1 ? 's' : ''} info` : 'Policy checked'}
      />
    </ul>
  );
}

function ChecklistItem({ state, label }: { state: CheckState; label: string }) {
  return (
    <li className={cx('progress-checklist__item', `progress-checklist__item--${state}`)}>
      <span className="progress-checklist__dot">
        {state === 'done' ? <Icon.Check size={11} /> : state === 'warn' ? <Icon.Alert size={10} /> : null}
      </span>
      {label}
    </li>
  );
}
