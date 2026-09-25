import { useParams } from 'react-router-dom';
import { useCurrentUser } from '../app/session.js';
import { PageHeader, Breadcrumb } from '../ui/PageHeader.js';
import {
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Notice,
  SkeletonRows,
} from '../ui/primitives.js';
import { Icon } from '../ui/icons.js';
import { StatusPill } from '../ui/domain.js';
import { ApiError } from '../api/client.js';
import { TripFacts } from '../features/claim/TripFacts.js';
import { ClaimLinesTable } from '../features/claim/ClaimLinesTable.js';
import { SettlementSummary } from '../features/claim/SettlementSummary.js';
import { ApprovalTimeline } from '../features/claim/ApprovalTimeline.js';
import { ApproverDecisionPanel } from '../features/claim/ApproverDecisionPanel.js';
import { FinanceDecisionPanel } from '../features/claim/FinanceDecisionPanel.js';
import { useTripDetail } from '../features/claim/useTripDetail.js';

type Area = 'approvals' | 'finance';

/**
 * Read-only claim readout + a decision panel. Same layout for approvers and
 * finance; only the panel changes.
 */
export function ReviewPage({ area }: { area: Area }) {
  const { id = '' } = useParams();
  const user = useCurrentUser();
  const q = useTripDetail(id);

  const backTo = area === 'approvals' ? '/approvals' : '/finance';
  const backLabel = area === 'approvals' ? 'Approvals' : 'Finance queue';

  if (q.isLoading) {
    return (
      <>
        <Breadcrumb trail={[{ label: backLabel, to: backTo }, { label: '…' }]} />
        <SkeletonRows rows={6} />
      </>
    );
  }

  if (q.error) {
    const notImpl = q.error instanceof ApiError && q.error.isNotImplemented;
    return (
      <>
        <Breadcrumb trail={[{ label: backLabel, to: backTo }, { label: id }]} />
        <Card>
          <CardBody>
            {notImpl ? (
              <EmptyState icon={<Icon.Clock size={20} />} title="Not available yet">
                The trip detail endpoint is still being built.
              </EmptyState>
            ) : (
              <Notice tone="danger">
                {q.error instanceof ApiError ? q.error.message : 'Could not load this claim.'}
              </Notice>
            )}
          </CardBody>
        </Card>
      </>
    );
  }

  const d = q.data!;

  return (
    <>
      <Breadcrumb trail={[{ label: backLabel, to: backTo }, { label: d.trip.travelRequestId }]} />
      <PageHeader
        eyebrow={area === 'approvals' ? 'Review for approval' : 'Finance review'}
        title={
          <span className="u-row u-gap-3">
            {d.trip.travelRequestId}
            <StatusPill status={d.trip.status} />
          </span>
        }
        subtitle={`${d.trip.purpose ?? ''} · claimant ${d.trip.employeeCode}`}
      />

      <div className="grid-2">
        <Card>
          <CardHeader title="Trip request" />
          <CardBody>
            <TripFacts trip={d.trip} />
          </CardBody>
        </Card>

        {area === 'approvals' ? (
          <ApproverDecisionPanel
            tripId={d.trip.id}
            steps={d.approvals}
            currentUserCode={user.empCode}
          />
        ) : (
          <FinanceDecisionPanel tripId={d.trip.id} status={d.trip.status} />
        )}
      </div>

      <Card>
        <CardHeader title={`Claim lines (${d.claimLines.length})`} />
        <CardBody flush>
          <ClaimLinesTable lines={d.claimLines} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Settlement summary" />
        <CardBody>
          {d.settlement ? (
            <SettlementSummary s={d.settlement} />
          ) : (
            <p className="u-muted">Not computed.</p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Approval chain" />
        <CardBody>
          {d.approvals.length > 0 ? (
            <ApprovalTimeline steps={d.approvals} />
          ) : (
            <p className="u-muted">No chain recorded.</p>
          )}
        </CardBody>
      </Card>
    </>
  );
}
