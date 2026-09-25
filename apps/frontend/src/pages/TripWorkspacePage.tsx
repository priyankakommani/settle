import { useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
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
import type { TripDetail } from '../api/types.js';
import { TripFacts } from '../features/claim/TripFacts.js';
import { TripProgressTracker } from '../features/claim/TripProgressTracker.js';
import { ClaimChecklist } from '../features/claim/ClaimChecklist.js';
import { DocumentsList } from '../features/claim/DocumentsList.js';
import { ClaimLinesTable } from '../features/claim/ClaimLinesTable.js';
import { SettlementSummary } from '../features/claim/SettlementSummary.js';
import { ApprovalTimeline } from '../features/claim/ApprovalTimeline.js';
import { EditTripModal } from '../features/claim/EditTripModal.js';
import { useTripAction, useTripDetail } from '../features/claim/useTripDetail.js';
import { inr } from '../lib/format.js';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'documents', label: 'Documents' },
  { id: 'claim-lines', label: 'Claim Lines' },
  { id: 'settlement', label: 'Settlement' },
  { id: 'approvals', label: 'Approvals' },
];

const EDITABLE_STATES: string[] = [TripStatus.DRAFT, TripStatus.RETURNED];

/** One-line "what/who/when/with whom" summary shown under the trip's ID, e.g. "Client visit — ₹20,000 · Sept 2026 · with Reporting Manager". */
function summaryLine(
  trip: TripDetail['trip'],
  approvals: TripDetail['approvals'],
  claimantName: string,
): string {
  const parts: string[] = [trip.purpose ?? 'Travel request'];
  if (trip.estimatedCost) parts.push(inr(trip.estimatedCost));
  const monthYear = new Date(trip.createdAt).toLocaleDateString('en-IN', {
    month: 'short',
    year: 'numeric',
  });
  const bits = [parts.join(' — '), claimantName, monthYear];

  switch (trip.status) {
    case TripStatus.PENDING_APPROVAL: {
      const pending = approvals.find((a) => a.decision === 'pending');
      bits.push(pending ? `with ${pending.role}` : 'with approver');
      break;
    }
    case TripStatus.PENDING_FINANCE:
      bits.push('with Finance');
      break;
    case TripStatus.VERIFIED:
      bits.push('awaiting payout');
      break;
    case TripStatus.PAID:
      bits.push('paid');
      break;
  }
  return bits.join(' · ');
}

/** The traveller's claim workspace: review the auto-built claim, fix it, submit. */
export function TripWorkspacePage() {
  const { id = '' } = useParams();
  const user = useCurrentUser();
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'overview';

  const q = useTripDetail(id);
  const { ingest, removeDocument, removeLine, recompute, submit, updateTrip, deleteTrip } =
    useTripAction(id);
  const fileInput = useRef<HTMLInputElement>(null);
  const [editTripOpen, setEditTripOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

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
  // Stricter than canEdit: once submitted the trip is part of someone else's
  // workflow, so it can be returned but never simply deleted.
  const canDelete = isOwner && d.trip.status === TripStatus.DRAFT;

  const doSubmit = () => {
    submit.mutate(undefined, {
      onSuccess: () => toast.success('Claim submitted for approval'),
      onError: (e) =>
        toast.error(e instanceof ApiError ? e.message : 'Could not submit the claim'),
    });
  };

  const doDelete = () => {
    deleteTrip.mutate(undefined, {
      onSuccess: () => {
        toast.success(`${d.trip.travelRequestId} deleted`);
        navigate('/trips');
      },
      onError: (e) => {
        toast.error(e instanceof ApiError ? e.message : 'Could not delete the trip');
        setDeleteConfirmOpen(false);
      },
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
        subtitle={summaryLine(d.trip, d.approvals, user.name)}
        actions={
          canEdit ? (
            <>
              <Button variant="secondary" onClick={() => setEditTripOpen(true)}>
                Edit trip
              </Button>
              {canDelete ? (
                <Button variant="danger" onClick={() => setDeleteConfirmOpen(true)}>
                  Delete trip
                </Button>
              ) : null}
              <Button
                onClick={() =>
                  recompute.mutate(undefined, {
                    onSuccess: () => toast.success('Claim recomputed'),
                    onError: (e) =>
                      toast.error(e instanceof ApiError ? e.message : 'Recompute failed'),
                  })
                }
                disabled={recompute.isPending}
                title="Re-evaluates every line against policy and refreshes the settlement totals"
              >
                {recompute.isPending ? 'Recomputing…' : 'Recompute claim'}
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

      {editTripOpen ? (
        <EditTripModal
          trip={d.trip}
          saving={updateTrip.isPending}
          error={updateTrip.error}
          onClose={() => setEditTripOpen(false)}
          onSave={(body) =>
            updateTrip.mutate(body, {
              onSuccess: () => {
                toast.success('Trip details updated');
                setEditTripOpen(false);
              },
            })
          }
        />
      ) : null}

      {deleteConfirmOpen ? (
        <div className="modal-overlay" onClick={() => setDeleteConfirmOpen(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Delete {d.trip.travelRequestId}?</span>
              <button
                type="button"
                className="btn btn--ghost btn--sm btn--icon"
                onClick={() => setDeleteConfirmOpen(false)}
              >
                <Icon.Close size={16} />
              </button>
            </div>
            <div className="modal-body">
              <Notice tone="warn">
                This permanently removes the trip and everything under it — documents, claim
                lines, and the settlement. This can&rsquo;t be undone.
              </Notice>
            </div>
            <div className="modal-footer">
              <Button variant="secondary" onClick={() => setDeleteConfirmOpen(false)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={doDelete} disabled={deleteTrip.isPending}>
                {deleteTrip.isPending ? 'Deleting…' : 'Delete trip'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <TripProgressTracker trip={d.trip} approvals={d.approvals} />

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

      {tab === 'documents' ? (
        <Card>
          <CardHeader
            title={`Documents (${d.documents.length})`}
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
            <ClaimChecklist documents={d.documents} claimLines={d.claimLines} settlement={d.settlement} />
            <DocumentsList
              grid
              tripId={d.trip.id}
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
      ) : null}

      {tab === 'claim-lines' ? (
        <Card>
          <CardHeader title={`Claim lines (${d.claimLines.length})`} />
          <CardBody flush>
            <ClaimLinesTable
              lines={d.claimLines}
              renderActions={
                canEdit
                  ? (line) => (
                      <span className="u-row u-gap-1">
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
                      </span>
                    )
                  : undefined
              }
            />
          </CardBody>
        </Card>
      ) : null}

      {tab === 'settlement' ? (
        <Card>
          <CardHeader title="Settlement summary" />
          <CardBody>
            {d.settlement ? (
              <SettlementSummary s={d.settlement} />
            ) : (
              <EmptyState title="Not computed yet">
                Recompute the claim to produce the settlement summary.
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
