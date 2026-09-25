import { useMemo, useState } from 'react';
import { CityTier } from '@settle/shared';
import type { TripDetail } from '../../api/types.js';
import type { CreateTripBody } from '../../api/endpoints.js';
import { Button, Notice } from '../../ui/primitives.js';
import { Field, Input, Select } from '../../ui/form.js';
import { Icon } from '../../ui/icons.js';
import { ApiError } from '../../api/client.js';
import { inr, sanitizeCityInput } from '../../lib/format.js';

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

function stateFromTrip(trip: TripDetail['trip']): FormState {
  return {
    purpose: trip.purpose ?? '',
    originCity: sanitizeCityInput(trip.originCity ?? ''),
    destCity: sanitizeCityInput(trip.destCity ?? ''),
    destTier: trip.destTier ?? CityTier.TIER_1,
    startDate: trip.startDate ?? '',
    endDate: trip.endDate ?? '',
    estimatedCost: trip.estimatedCost ?? '',
    advanceRequested: trip.advanceRequested ?? '',
  };
}

/** Edit the trip-request fields — same shape as raising one, resent in full (a PATCH here replaces, it doesn't merge). */
export function EditTripModal({
  trip,
  onClose,
  onSave,
  saving,
  error,
}: {
  trip: TripDetail['trip'];
  onClose: () => void;
  onSave: (body: CreateTripBody) => void;
  saving?: boolean;
  error?: unknown;
}) {
  const [form, setForm] = useState<FormState>(() => stateFromTrip(trip));

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

  const [localError, setLocalError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (advanceOverLimit) {
      setLocalError(`The advance requested cannot exceed 60% of the estimate (${inr(maxAdvance)}).`);
      return;
    }
    onSave({
      purpose: form.purpose || undefined,
      originCity: form.originCity || undefined,
      destCity: form.destCity || undefined,
      destTier: form.destTier || undefined,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      estimatedCost: form.estimatedCost ? estimate : undefined,
      advanceRequested: form.advanceRequested ? advance : undefined,
    });
  };

  const fieldErr = useMemo(() => {
    if (!(error instanceof ApiError) || error.code !== 'VALIDATION_ERROR') return {};
    const issues = (error.details as { issues?: { fieldErrors?: Record<string, string[]> } })
      ?.issues;
    const flat: Record<string, string> = {};
    for (const [k, v] of Object.entries(issues?.fieldErrors ?? {})) if (v?.[0]) flat[k] = v[0];
    return flat;
  }, [error]);

  const errorMessage =
    error instanceof ApiError
      ? error.code === 'VALIDATION_ERROR'
        ? null
        : error.message
      : error
        ? 'Could not save this trip.'
        : localError;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog modal-dialog--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Edit travel request</span>
          <button type="button" className="btn btn--ghost btn--sm btn--icon" onClick={onClose}>
            <Icon.Close size={16} />
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            {errorMessage ? <Notice tone="danger">{errorMessage}</Notice> : null}

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
                {(id) => <Input id={id} type="date" value={form.startDate} onChange={set('startDate')} />}
              </Field>
              <Field label="To date" error={fieldErr.endDate} required>
                {(id) => <Input id={id} type="date" value={form.endDate} onChange={set('endDate')} />}
              </Field>
            </div>

            <div className="grid-2">
              <Field label="Estimated cost (INR)" error={fieldErr.estimatedCost} required>
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
                error={fieldErr.advanceRequested}
                hint={
                  estimate > 0
                    ? `Up to 60% of the estimate — max ${inr(maxAdvance)} (policy 1.2)`
                    : 'Up to 60% of the estimated cost (policy 1.2)'
                }
              >
                {(id) => (
                  <Input
                    id={id}
                    type="number"
                    min="0"
                    step="100"
                    inputMode="decimal"
                    aria-invalid={advanceOverLimit}
                    value={form.advanceRequested}
                    onChange={set('advanceRequested')}
                    placeholder="20000"
                  />
                )}
              </Field>
            </div>

            {advanceOverLimit ? (
              <Notice tone="warn">
                The advance requested ({inr(advance)}) is above 60% of the estimate. Reduce it to {inr(maxAdvance)} or
                less.
              </Notice>
            ) : null}
          </div>
          <div className="modal-footer">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={saving || advanceOverLimit}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
