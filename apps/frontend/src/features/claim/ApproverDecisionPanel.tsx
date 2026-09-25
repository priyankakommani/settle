import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { approvalsApi, type ApprovalDecisionBody } from '../../api/endpoints.js';
import { ApiError } from '../../api/client.js';
import type { ApprovalStep, TripDetail } from '../../api/types.js';
import { useToast } from '../../ui/toast.js';
import { Button, Card, CardBody, CardHeader, Notice } from '../../ui/primitives.js';
import { Field, Textarea } from '../../ui/form.js';
import { tripDetailKey } from './useTripDetail.js';

/** Approve / Return / Reject for the approver whose turn it is. */
export function ApproverDecisionPanel({
  tripId,
  steps,
  currentUserCode,
}: {
  tripId: string;
  steps: ApprovalStep[];
  currentUserCode: string;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const [remarks, setRemarks] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const firstPending = steps.find((s) => s.decision === 'pending');
  const myStep = firstPending && firstPending.approverCode === currentUserCode ? firstPending : null;

  const decide = useMutation({
    mutationFn: (decision: ApprovalDecisionBody['decision']) => {
      if (decision !== 'approved' && !remarks.trim()) {
        return Promise.reject(new Error('Remarks are required to return or reject.'));
      }
      return approvalsApi.decide(tripId, myStep!.level, { decision, remarks: remarks.trim() || undefined });
    },
    onSuccess: (data: TripDetail, decision) => {
      qc.setQueryData(tripDetailKey(tripId), data);
      qc.invalidateQueries({ queryKey: ['queue'] });
      toast.success(
        decision === 'approved' ? 'Approved' : decision === 'returned' ? 'Returned to employee' : 'Rejected',
      );
      navigate('/approvals');
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : (e as Error).message),
  });

  if (!firstPending) {
    return (
      <Card>
        <CardHeader title="Decision" />
        <CardBody>
          <Notice tone="info">All business approvals are complete for this claim.</Notice>
        </CardBody>
      </Card>
    );
  }

  if (!myStep) {
    return (
      <Card>
        <CardHeader title="Decision" />
        <CardBody>
          <Notice tone="info">
            This claim is currently with <strong>{firstPending.role}</strong>
            {firstPending.approverCode ? ` (${firstPending.approverCode})` : ''}. You'll see it here when
            it reaches your level.
          </Notice>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title={`Your decision — level ${myStep.level} (${myStep.role})`} />
      <CardBody className="u-col u-gap-4">
        {err ? <Notice tone="danger">{err}</Notice> : null}
        <Field label="Remarks" hint="Required when returning or rejecting.">
          {(id) => (
            <Textarea
              id={id}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Note anything the employee or finance should know…"
            />
          )}
        </Field>
        <div className="u-row u-gap-2 u-wrap">
          <Button
            variant="primary"
            disabled={decide.isPending}
            onClick={() => decide.mutate('approved')}
          >
            Approve
          </Button>
          <Button disabled={decide.isPending} onClick={() => decide.mutate('returned')}>
            Return for correction
          </Button>
          <Button variant="danger" disabled={decide.isPending} onClick={() => decide.mutate('rejected')}>
            Reject
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
