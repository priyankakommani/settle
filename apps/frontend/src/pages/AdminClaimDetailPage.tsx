import { useParams } from 'react-router-dom';
import { Breadcrumb, PageHeader } from '../ui/PageHeader.js';
import { AsyncSection } from '../ui/AsyncSection.js';
import { Card, CardBody, CardHeader, SkeletonRows } from '../ui/primitives.js';
import { StatusPill } from '../ui/domain.js';
import { TripFacts } from '../features/claim/TripFacts.js';
import { ClaimLinesTable } from '../features/claim/ClaimLinesTable.js';
import { SettlementSummary } from '../features/claim/SettlementSummary.js';
import { ApprovalTimeline } from '../features/claim/ApprovalTimeline.js';
import { DocumentsList } from '../features/claim/DocumentsList.js';
import { useTripDetail } from '../features/claim/useTripDetail.js';

/** Read-only claim inspection for organisation oversight. */
export function AdminClaimDetailPage() {
  const { id = '' } = useParams();
  const q = useTripDetail(id);

  if (q.isLoading) {
    return <><Breadcrumb trail={[{ label: 'Claim register', to: '/admin/claims' }, { label: '…' }]} /><SkeletonRows rows={6} /></>;
  }

  return (
    <AsyncSection loading={false} error={q.error} data={q.data}>
      {(detail) => (
        <>
          <Breadcrumb trail={[{ label: 'Claim register', to: '/admin/claims' }, { label: detail.trip.travelRequestId }]} />
          <PageHeader
            eyebrow="Read-only claim inspection"
            title={<span className="u-row u-gap-3">{detail.trip.travelRequestId}<StatusPill status={detail.trip.status} /></span>}
            subtitle={`${detail.trip.purpose ?? 'Travel request'} · claimant ${detail.trip.employeeCode}`}
          />
          <div className="grid-2">
            <Card><CardHeader title="Trip request" /><CardBody><TripFacts trip={detail.trip} /></CardBody></Card>
            <Card><CardHeader title="Approval chain" /><CardBody>{detail.approvals.length ? <ApprovalTimeline steps={detail.approvals} /> : <p className="u-muted">Not submitted yet.</p>}</CardBody></Card>
          </div>
          <Card><CardHeader title={`Claim lines (${detail.claimLines.length})`} /><CardBody flush><ClaimLinesTable lines={detail.claimLines} /></CardBody></Card>
          <Card><CardHeader title="Settlement summary" /><CardBody>{detail.settlement ? <SettlementSummary s={detail.settlement} /> : <p className="u-muted">Not computed.</p>}</CardBody></Card>
          <Card><CardHeader title={`Source documents (${detail.documents.length})`} /><CardBody><DocumentsList documents={detail.documents} grid /></CardBody></Card>
        </>
      )}
    </AsyncSection>
  );
}
