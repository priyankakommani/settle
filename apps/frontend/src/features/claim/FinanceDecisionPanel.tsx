import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { TripStatus } from '@settle/shared';
import { financeApi } from '../../api/endpoints.js';
import { ApiError } from '../../api/client.js';
import type { TripDetail } from '../../api/types.js';
import { useToast } from '../../ui/toast.js';
import { Button, Card, CardBody, CardHeader, Notice } from '../../ui/primitives.js';
import { Field, Textarea } from '../../ui/form.js';
import { tripDetailKey } from './useTripDetail.js';

/** Finance verification then payment release, gated by the claim's status. */
export function FinanceDecisionPanel({ tripId, status }: { tripId: string; status: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const [remarks, setRemarks] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const settle = (data: TripDetail) => {
    qc.setQueryData(tripDetailKey(tripId), data);
    qc.invalidateQueries({ queryKey: ['queue'] });
  };
  const fail = (e: unknown) => setErr(e instanceof ApiError ? e.message : (e as Error).message);

  const verify = useMutation({
    mutationFn: () => financeApi.verify(tripId),
    onSuccess: (d) => {
      settle(d);
      toast.success('Claim verified');
    },
    onError: fail,
  });
  const ret = useMutation({
    mutationFn: () => {
      if (!remarks.trim()) return Promise.reject(new Error('Remarks are required to return.'));
      return financeApi.returnToEmployee(tripId, remarks.trim());
    },
    onSuccess: (d) => {
      settle(d);
      toast.success('Returned to employee');
      navigate('/finance');
    },
    onError: fail,
  });
  const pay = useMutation({
    mutationFn: () => financeApi.pay(tripId),
    onSuccess: (d) => {
      settle(d);
      toast.success('Payment released');
      navigate('/finance');
    },
    onError: fail,
  });

  const busy = verify.isPending || ret.isPending || pay.isPending;

  return (
    <Card>
      <CardHeader title="Finance processing" />
      <CardBody className="u-col u-gap-4">
        {err ? <Notice tone="danger">{err}</Notice> : null}

        {status === TripStatus.PENDING_FINANCE ? (
          <>
            <Field label="Remarks" hint="Required only when returning.">
              {(id) => (
                <Textarea
                  id={id}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Reason for returning the claim…"
                />
              )}
            </Field>
            <div className="u-row u-gap-2 u-wrap">
              <Button variant="primary" disabled={busy} onClick={() => verify.mutate()}>
                Verify claim
              </Button>
              <Button disabled={busy} onClick={() => ret.mutate()}>
                Return to employee
              </Button>
            </div>
          </>
        ) : status === TripStatus.VERIFIED ? (
          <>
            <Notice tone="info">
              Verified. Release payment in the next run (10th / 25th).
            </Notice>
            <div>
              <Button variant="primary" disabled={busy} onClick={() => pay.mutate()}>
                Release payment
              </Button>
            </div>
          </>
        ) : status === TripStatus.PAID ? (
          <Notice tone="info">Payment has been released for this claim.</Notice>
        ) : (
          <Notice tone="warn">
            This claim isn't with finance yet (status: {status}). It appears here once all business
            approvals are complete.
          </Notice>
        )}
      </CardBody>
    </Card>
  );
}
