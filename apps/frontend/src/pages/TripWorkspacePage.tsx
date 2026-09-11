import { useMemo, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { PolicyVerdict, TripStatus } from '@settle/shared';
import { useCurrentUser } from '../app/session.js';
import { useToast } from '../ui/toast.js';
import { PageHeader, Breadcrumb } from '../ui/PageHeader.js';
import { Tabs } from '../ui/Tabs.js';
import {
  Button,
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
import { DocumentsList } from '../features/claim/DocumentsList.js';
import { ClaimLinesTable } from '../features/claim/ClaimLinesTable.js';
import { SettlementSummary } from '../features/claim/SettlementSummary.js';
import { ApprovalTimeline } from '../features/claim/ApprovalTimeline.js';
import { useTripAction, useTripDetail } from '../features/claim/useTripDetail.js';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'claim', label: 'Inbox & Claim' },
  { id: 'settlement', label: 'Settlement' },
  { id: 'approvals', label: 'Approvals' },
];

const EDITABLE_STATES: string[] = [TripStatus.DRAFT, TripStatus.RETURNED];

/** The traveller's claim workspace: review the auto-built claim, fix it, submit. */
export function TripWorkspacePage() {
  const { id = '' } = useParams();
  const user = useCurrentUser();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'overview';

  const q = useTripDetail(id);
  const { ingest, removeDocument, removeLine, recompute, submit } = useTripAction(id);
  const fileInput = useRef<HTMLInputElement>(null);

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    ingest.mutate(files, {
      onSuccess: (r) =>
        toast.success(
          `Ingested ${files.length} file(s) — ${r.insertedLines} line(s) added, ${r.duplicatesDropped} duplicate(s) skipped`,
        ),
      onError: (err) =>
        toast.error(err instanceof ApiError ? err.message : 'Could not ingest the documents'),
    });
  };

  const blockers = useMemo(() => {
    const d = q.data;
    if (!d) return [];
    const out: string[] = [];
    const claimable = d.claimLines.filter((l) => l.paidBy === 'Employee');
    if (claimable.length === 0) out.push('No claimable lines.');
    if (claimable.some((l) => !l.proofRef && !l.sourceDocumentId))
      out.push('Some lines have no supporting document.');
    if (d.claimLines.some((l) => l.policyVerdict === PolicyVerdict.NEEDS_INFO))
      out.push('Some lines still need information.');
    return out;
  }, [q.data]);

  // `q.data` without a `.trip` means a stale/partial cache entry — treat it as
  // still loading; React Query is already refetching the canonical detail.
  if (q.isLoading || (q.data && !q.data.trip)) {
    return (
      <>
        <Breadcrumb trail={[{ label: 'My Trips', to: '/trips' }, { label: '…' }]} />
        <SkeletonRows rows={6} />
      </>
    );
  }

  if (q.error) {
    const notImpl = q.error instanceof ApiError && q.error.isNotImplemented;
    return (
      <>
        <Breadcrumb trail={[{ label: 'My Trips', to: '/trips' }, { label: id }]} />
        <Card>
          <CardBody>
            {notImpl ? (
              <EmptyState icon={<Icon.Clock size={20} />} title="Not available yet">
                The trip detail endpoint is still being built. Navigation and layout are final.
              </EmptyState>
            ) : (
              <Notice tone="danger">
                {q.error instanceof ApiError ? q.error.message : 'Could not load this trip.'}
              </Notice>
            )}
          </CardBody>
        </Card>
      </>
    );
  }

  const d = q.data!;
  const isOwner = d.trip.employeeCode === user.empCode;
  const canEdit = isOwner && EDITABLE_STATES.includes(d.trip.status);

  const doSubmit = () => {
    submit.mutate(undefined, {
      onSuccess: () => toast.success('Claim submitted for approval'),
      onError: (e) =>
        toast.error(e instanceof ApiError ? e.message : 'Could not submit the claim'),
    });
  };

  return (
    <>
      <Breadcrumb
        trail={[{ label: 'My Trips', to: '/trips' }, { label: d.trip.travelRequestId }]}
      />
      <PageHeader
        eyebrow={d.trip.destCity ?? 'Trip'}
        title={
          <span className="u-row u-gap-3">
            {d.trip.travelRequestId}
            <StatusPill status={d.trip.status} />
          </span>
        }
        subtitle={d.trip.purpose ?? undefined}
        actions={
          canEdit ? (
            <>
              <Button
                onClick={() =>
                  recompute.mutate(undefined, {
                    onSuccess: () => toast.success('Policy check re-run'),
                    onError: (e) =>
                      toast.error(e instanceof ApiError ? e.message : 'Recompute failed'),
                  })
                }
                disabled={recompute.isPending}
              >
                {recompute.isPending ? 'Checking…' : 'Run policy check'}
              </Button>
              <Button
                variant="primary"
                onClick={doSubmit}
                disabled={submit.isPending || blockers.length > 0}
                title={blockers.length ? blockers.join(' ') : undefined}
              >
                {submit.isPending ? 'Submitting…' : 'Submit claim'}
              </Button>
            </>
          ) : null
        }
      />

      {canEdit && blockers.length > 0 ? (
        <Notice tone="warn">
          <Icon.Alert size={16} />
          <span>Resolve before submitting: {blockers.join(' ')}</span>
        </Notice>
      ) : null}

      <Tabs
        tabs={TABS}
        active={tab}
        onChange={(id2) =>
          setParams(
            (p) => {
              p.set('tab', id2);
              return p;
            },
            { replace: true },
          )
        }
      />

      {tab === 'overview' ? (
        <div className="grid-2">
          <Card>
            <CardHeader title="Trip request" />
            <CardBody>
              <TripFacts trip={d.trip} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Where it stands" />
            <CardBody>
              {d.approvals.length > 0 ? (
                <ApprovalTimeline steps={d.approvals} />
              ) : (
                <p className="u-muted">Not submitted yet. Build the claim, then submit for approval.</p>
              )}
            </CardBody>
          </Card>
        </div>
      ) : null}

      {tab === 'claim' ? (
        <div className="u-col u-gap-4">
          <Card>
            <CardHeader
              title={`Inbox (${d.documents.length})`}
              actions={
                canEdit ? (
                  <>
                    <input
                      ref={fileInput}
                      type="file"
                      multiple
                      accept=".eml,message/rfc822,image/*,application/pdf"
                      hidden
                      onChange={onPickFiles}
                    />
                    <Button
                      onClick={() => fileInput.current?.click()}
                      disabled={ingest.isPending}
                    >
                      {ingest.isPending ? 'Ingesting…' : 'Upload emails / receipts'}
                    </Button>
                  </>
                ) : null
              }
            />
            <CardBody>
              <DocumentsList
                grid
                documents={d.documents}
                claimLines={d.claimLines}
                removingId={removeDocument.isPending ? removeDocument.variables : null}
                onRemove={
                  canEdit
                    ? (docId) =>
                        removeDocument.mutate(docId, {
                          onSuccess: () => toast.success('Document removed'),
                          onError: (e) =>
                            toast.error(
                              e instanceof ApiError ? e.message : 'Could not remove the document',
                            ),
                        })
                    : undefined
                }
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={`Claim lines (${d.claimLines.length})`} />
            <CardBody flush>
              <ClaimLinesTable
                lines={d.claimLines}
                renderActions={
                  canEdit
                    ? (line) => (
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm btn--icon"
                          title="Remove this line"
                          disabled={removeLine.isPending && removeLine.variables === line.id}
                          onClick={() =>
                            removeLine.mutate(line.id, {
                              onSuccess: () => toast.success('Line removed'),
                              onError: (e) =>
                                toast.error(
                                  e instanceof ApiError ? e.message : 'Could not remove the line',
                                ),
                            })
                          }
                        >
                          <Icon.Close size={14} />
                        </button>
                      )
                    : undefined
                }
              />
            </CardBody>
          </Card>
        </div>
      ) : null}

      {tab === 'settlement' ? (
        <Card>
          <CardHeader title="Settlement summary" />
          <CardBody>
            {d.settlement ? (
              <SettlementSummary s={d.settlement} />
            ) : (
              <EmptyState title="Not computed yet">
                Run the policy check to produce the settlement summary.
              </EmptyState>
            )}
          </CardBody>
        </Card>
      ) : null}

      {tab === 'approvals' ? (
        <Card>
          <CardHeader title="Approval chain" />
          <CardBody>
            {d.approvals.length > 0 ? (
              <ApprovalTimeline steps={d.approvals} />
            ) : (
              <EmptyState title="No approval chain yet">
                The chain is built from the claim value when you submit.
              </EmptyState>
            )}
          </CardBody>
        </Card>
      ) : null}
    </>
  );
}
