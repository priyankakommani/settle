import { useState } from 'react';
import { ClaimCategory, PaidBy } from '@settle/shared';
import type { ClaimLine } from '../../api/types.js';
import type { ClaimLineBody } from '../../api/endpoints.js';
import { Button, Notice } from '../../ui/primitives.js';
import { Field, Input, Select } from '../../ui/form.js';
import { Icon } from '../../ui/icons.js';
import { ApiError } from '../../api/client.js';
import { shortDate } from '../../lib/format.js';

const CATEGORY_LABEL: Record<string, string> = {
  [ClaimCategory.LODGING]: 'Lodging',
  [ClaimCategory.CONVEYANCE]: 'Conveyance',
  [ClaimCategory.MEAL]: 'Meals',
  [ClaimCategory.BUSINESS_ENTERTAINMENT]: 'Business entertainment',
  [ClaimCategory.OTHER]: 'Other',
};

type FormState = {
  category: string;
  merchant: string;
  lineDate: string;
  currency: string;
  grossAmount: string;
  taxAmount: string;
  paidBy: string;
  description: string;
};

function stateFromLine(line: ClaimLine | null): FormState {
  return {
    category: line?.category ?? ClaimCategory.OTHER,
    merchant: line?.merchant ?? '',
    lineDate: line?.lineDate ?? '',
    currency: line?.currency ?? 'INR',
    grossAmount: line ? String(line.grossAmount) : '',
    taxAmount: line ? String(line.taxAmount) : '0',
    paidBy: line?.paidBy ?? PaidBy.EMPLOYEE,
    description: line?.description ?? '',
  };
}

/**
 * Add or edit a claim line by hand. Editing never touches the attached proof
 * (sourceDocumentId/proofRef stay as-is) — this only corrects what the
 * extraction pipeline read wrong. On first edit of a machine-extracted line,
 * the backend snapshots what it originally read into `policyMeta.originalExtraction`,
 * which we surface here so the claimant (and later, the approver) can see
 * exactly what changed instead of a silent overwrite.
 */
export function ClaimLineFormModal({
  line,
  onClose,
  onSave,
  saving,
  error,
}: {
  /** null = "add a new line"; a ClaimLine = "edit this one" */
  line: ClaimLine | null;
  onClose: () => void;
  onSave: (body: ClaimLineBody) => void;
  saving?: boolean;
  error?: unknown;
}) {
  const [form, setForm] = useState<FormState>(() => stateFromLine(line));

  const set =
    (k: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const original = line?.policyMeta?.originalExtraction;
  // Before the first edit, `line` itself still holds the raw extraction —
  // show that as the reference point even though no snapshot exists yet.
  const reference = original ?? (line && !line.editedByUser ? {
    category: line.category,
    merchant: line.merchant,
    lineDate: line.lineDate,
    currency: line.currency,
    grossAmount: line.grossAmount,
  } : null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const gross = Number(form.grossAmount);
    if (!Number.isFinite(gross) || gross < 0) return;
    onSave({
      category: form.category,
      merchant: form.merchant.trim() || undefined,
      description: form.description.trim() || undefined,
      lineDate: form.lineDate || undefined,
      currency: form.currency.trim().toUpperCase() || 'INR',
      grossAmount: gross,
      taxAmount: form.taxAmount ? Number(form.taxAmount) : 0,
      paidBy: form.paidBy,
    });
  };

  const errorMessage =
    error instanceof ApiError ? error.message : error ? 'Could not save this line.' : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{line ? 'Edit claim line' : 'Add claim line manually'}</span>
          <button type="button" className="btn btn--ghost btn--sm btn--icon" onClick={onClose}>
            <Icon.Close size={16} />
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            {errorMessage ? <Notice tone="danger">{errorMessage}</Notice> : null}

            {!line ? (
              <Notice tone="warn">
                This line has no receipt attached. It will be blocked at submission
                (&ldquo;missing proof&rdquo;) until you attach one via Documents, so use this only
                as a placeholder to fill in later.
              </Notice>
            ) : null}

            {reference ? (
              <Notice tone="info">
                Originally read from the document: {CATEGORY_LABEL[reference.category] ?? reference.category}
                {reference.merchant ? ` · ${reference.merchant}` : ''} · {reference.currency}{' '}
                {reference.grossAmount}
                {reference.lineDate ? ` · ${shortDate(reference.lineDate)}` : ''}
              </Notice>
            ) : null}

            <div className="grid-2">
              <Field label="Category" required>
                {(id) => (
                  <Select id={id} value={form.category} onChange={set('category')} required>
                    {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Paid by">
                {(id) => (
                  <Select id={id} value={form.paidBy} onChange={set('paidBy')}>
                    <option value={PaidBy.EMPLOYEE}>Employee</option>
                    <option value={PaidBy.COMPANY}>Company (memo only)</option>
                  </Select>
                )}
              </Field>
            </div>

            <Field label="Merchant">
              {(id) => (
                <Input
                  id={id}
                  value={form.merchant}
                  onChange={set('merchant')}
                  placeholder="e.g. Uber, Keys Prime Hotel"
                />
              )}
            </Field>

            <div className="grid-3">
              <Field label="Date">
                {(id) => <Input id={id} type="date" value={form.lineDate} onChange={set('lineDate')} />}
              </Field>
              <Field label="Currency" hint="3-letter code">
                {(id) => (
                  <Input
                    id={id}
                    value={form.currency}
                    onChange={set('currency')}
                    maxLength={3}
                    style={{ textTransform: 'uppercase' }}
                  />
                )}
              </Field>
              <Field label="Amount" required>
                {(id) => (
                  <Input
                    id={id}
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={form.grossAmount}
                    onChange={set('grossAmount')}
                    required
                  />
                )}
              </Field>
            </div>

            <Field label="Tax amount" hint="Included in the total above, shown separately">
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={form.taxAmount}
                  onChange={set('taxAmount')}
                />
              )}
            </Field>
          </div>
          <div className="modal-footer">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? 'Saving…' : line ? 'Save changes' : 'Add line'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
