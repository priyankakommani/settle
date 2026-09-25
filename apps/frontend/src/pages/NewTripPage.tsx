import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CityTier } from '@settle/shared';
import { tripsApi, type CreateTripBody } from '../api/endpoints.js';
import { ApiError } from '../api/client.js';
import { useToast } from '../ui/toast.js';
import { PageHeader, Breadcrumb } from '../ui/PageHeader.js';
import { Button, Card, CardBody, CardFooter, Notice } from '../ui/primitives.js';
import { Field, Input, Select } from '../ui/form.js';
import { inr, sanitizeCityInput } from '../lib/format.js';

type FormState = {
  purpose: string;
  originCity: string;
  destCity: string;
  destTier: string;
  startDate: string;
  endDate: string;
  estimatedCost: string;
  advanceRequested: string;
};

const EMPTY: FormState = {
  purpose: '',
  originCity: '',
  destCity: '',
  destTier: CityTier.TIER_1,
  startDate: '',
  endDate: '',
  estimatedCost: '',
  advanceRequested: '',
};

/**
 * Raise a Travel Request. The Travel Request ID is issued by the system on
 * submit (policy 1.1) — the employee never types it.
 */
export function NewTripPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});

  const set =
    (k: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const setCity =
    (k: 'originCity' | 'destCity') => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [k]: sanitizeCityInput(e.target.value) }));

  const estimate = Number(form.estimatedCost) || 0;
  const advance = Number(form.advanceRequested) || 0;
  const maxAdvance = useMemo(() => Math.round(estimate * 0.6 * 100) / 100, [estimate]);
  const advanceOverLimit = estimate > 0 && advance > maxAdvance;

  const create = useMutation({
    mutationFn: () => {
      const body: CreateTripBody = {
        purpose: form.purpose || undefined,
        originCity: form.originCity || undefined,
        destCity: form.destCity || undefined,
        destTier: form.destTier || undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        estimatedCost: form.estimatedCost ? estimate : undefined,
        advanceRequested: form.advanceRequested ? advance : undefined,
      };
      return tripsApi.create(body);
    },
    onSuccess: (trip) => {
      qc.invalidateQueries({ queryKey: ['trips'] });
      toast.success(`Travel request ${trip.travelRequestId} raised`);
      navigate(`/trips/${trip.id}`);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'VALIDATION_ERROR') {
        const issues = (err.details as { issues?: { fieldErrors?: Record<string, string[]> } })
          ?.issues;
        const flat: Record<string, string> = {};
        for (const [k, v] of Object.entries(issues?.fieldErrors ?? {})) if (v?.[0]) flat[k] = v[0];
        setFieldErr(flat);
      }
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErr({});
    if (advanceOverLimit) {
      setFieldErr({
        advanceRequested: `Cannot exceed 60% of the estimate (${inr(maxAdvance)})`,
      });
      return;
    }
    create.mutate();
  };

  return (
    <>
      <Breadcrumb trail={[{ label: 'My Trips', to: '/trips' }, { label: 'New travel request' }]} />
      <PageHeader
        eyebrow="Traveller"
        title="New travel request"
        subtitle="Raise this before booking. A Travel Request ID is issued when you submit."
      />

      <form onSubmit={submit}>
        <Card>
          <CardBody className="u-col u-gap-4">
            {create.error &&
            !(create.error instanceof ApiError && create.error.code === 'VALIDATION_ERROR') ? (
              <Notice tone="danger">
                {create.error instanceof ApiError
                  ? create.error.message
                  : 'Could not raise the request.'}
              </Notice>
            ) : null}

            <Field label="Purpose of travel" error={fieldErr.purpose} required>
              {(id) => (
                <Input
                  id={id}
                  value={form.purpose}
                  onChange={set('purpose')}
                  placeholder="Customer meeting + site visit"
                  autoFocus
                />
              )}
            </Field>

            <div className="grid-2">
              <Field label="From city" error={fieldErr.originCity} required>
                {(id) => (
                  <Input
                    id={id}
                    value={form.originCity}
                    onChange={setCity('originCity')}
                    placeholder="Pune"
                    autoComplete="off"
                  />
                )}
              </Field>
              <Field label="Destination city" error={fieldErr.destCity} required>
                {(id) => (
                  <Input
                    id={id}
                    value={form.destCity}
                    onChange={setCity('destCity')}
                    placeholder="Bengaluru"
                    autoComplete="off"
                  />
                )}
              </Field>
            </div>

            <div className="grid-3">
              <Field label="City class" hint="Drives lodging & meal caps" required>
                {(id) => (
                  <Select id={id} value={form.destTier} onChange={set('destTier')}>
                    <option value={CityTier.TIER_1}>Tier 1</option>
                    <option value={CityTier.TIER_2}>Tier 2</option>
                    <option value={CityTier.TIER_3}>Tier 3</option>
                  </Select>
                )}
              </Field>
              <Field label="From date" error={fieldErr.startDate} required>
                {(id) => (
                  <Input id={id} type="date" value={form.startDate} onChange={set('startDate')} />
                )}
              </Field>
              <Field label="To date" error={fieldErr.endDate} required>
                {(id) => (
                  <Input id={id} type="date" value={form.endDate} onChange={set('endDate')} />
                )}
              </Field>
            </div>

            <div className="grid-2">
              <Field
                label="Estimated cost (INR)"
                hint="Your estimate of the employee-borne spend for this trip"
                error={fieldErr.estimatedCost}
                required
              >
                {(id) => (
                  <Input
                    id={id}
                    type="number"
                    min="0"
                    step="100"
                    inputMode="decimal"
                    value={form.estimatedCost}
                    onChange={set('estimatedCost')}
                    placeholder="48000"
                  />
                )}
              </Field>
              <Field
                label="Advance requested (INR)"
                hint={
                  estimate > 0
                    ? `Up to 60% of the estimate — max ${inr(maxAdvance)} (policy 1.2)`
                    : 'Up to 60% of the estimated cost (policy 1.2)'
                }
                error={fieldErr.advanceRequested}
              >
                {(id, invalid) => (
                  <Input
                    id={id}
                    type="number"
                    min="0"
                    step="100"
                    inputMode="decimal"
                    aria-invalid={invalid || advanceOverLimit}
                    value={form.advanceRequested}
                    onChange={set('advanceRequested')}
                    placeholder="20000"
                  />
                )}
              </Field>
            </div>

            {advanceOverLimit ? (
              <Notice tone="warn">
                The advance requested ({inr(advance)}) is above 60% of the estimate. Reduce it to{' '}
                {inr(maxAdvance)} or less.
              </Notice>
            ) : null}
          </CardBody>
          <CardFooter>
            <Button type="button" variant="ghost" onClick={() => navigate('/trips')}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={create.isPending || advanceOverLimit}>
              {create.isPending ? 'Raising…' : 'Raise travel request'}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </>
  );
}
