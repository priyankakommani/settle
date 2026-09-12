import { useState, type ReactNode } from 'react';
import type { ClaimLine } from '../../api/types.js';
import { Money, VerdictTag } from '../../ui/domain.js';
import { Button, EmptyState } from '../../ui/primitives.js';
import { Icon } from '../../ui/icons.js';
import { shortDate } from '../../lib/format.js';

const CATEGORY_LABEL: Record<string, string> = {
  lodging: 'Lodging',
  conveyance: 'Conveyance',
  meal: 'Meals',
  business_entertainment: 'Business entertainment',
  other: 'Other',
};

interface OriginalExtraction {
  category: string;
  merchant: string | null;
  lineDate: string | null;
  currency: string;
  grossAmount: string;
}

interface SelectedProof {
  merchant: string;
  category: string;
  lineDate?: string | null;
  grossAmount: number;
  allowedAmount: number;
  disallowedAmount: number;
  proofRef?: string | null;
  sourceDocumentId?: string | null;
  verdict: string;
  reasonText?: string | null;
  editedByUser?: boolean;
  originalExtraction?: OriginalExtraction;
}

/**
 * The claim lines with their policy verdict. Read-only here; the editable
 * variant on the workspace screen adds an actions column via `renderActions`.
 */
export function ClaimLinesTable({
  lines,
  renderActions,
}: {
  lines: ClaimLine[];
  renderActions?: (line: ClaimLine) => ReactNode;
}) {
  const [selectedProof, setSelectedProof] = useState<SelectedProof | null>(null);

  if (lines.length === 0) {
    return (
      <EmptyState icon={<Icon.Inbox size={20} />} title="No claim lines yet">
        Add the trip's receipts — claim lines are built and recomputed automatically.
      </EmptyState>
    );
  }

  return (
    <div className="table-wrap">
      <table className="table table--wide">
        <thead>
          <tr>
            <th>Item</th>
            <th>Date</th>
            <th>Paid by</th>
            <th className="table__num">Gross</th>
            <th className="table__num">Allowed</th>
            <th className="table__num">Disallowed</th>
            <th>Verdict</th>
            <th>Proof</th>
            {renderActions ? <th aria-label="Actions" /> : null}
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => {
            const memoOnly = l.paidBy === 'Company';
            const showReason = l.reasonText && l.policyVerdict !== 'allowed';
            const merchantName = l.merchant ?? CATEGORY_LABEL[l.category] ?? l.category;
            const grossNum = typeof l.grossAmount === 'number' ? l.grossAmount : parseFloat(String(l.grossAmount || 0));
            const allowedNum = typeof l.allowedAmount === 'number' ? l.allowedAmount : parseFloat(String(l.allowedAmount || 0));
            const disallowedNum = typeof l.disallowedAmount === 'number' ? l.disallowedAmount : parseFloat(String(l.disallowedAmount || 0));
            const originalExtraction = l.policyMeta?.originalExtraction;
            const proofPayload: SelectedProof = {
              merchant: merchantName,
              category: CATEGORY_LABEL[l.category] ?? l.category,
              lineDate: l.lineDate,
              grossAmount: grossNum,
              allowedAmount: allowedNum,
              disallowedAmount: disallowedNum,
              proofRef: l.proofRef,
              sourceDocumentId: l.sourceDocumentId,
              verdict: l.policyVerdict ?? 'allowed',
              reasonText: l.reasonText,
              editedByUser: l.editedByUser,
              originalExtraction,
            };

            return (
              <tr key={l.id} className={memoOnly ? 'table__row-strike' : undefined}>
                <td className="table__cell--primary">
                  <div className="u-strong">
                    {merchantName}
                  </div>
                  <div className="u-subtle" style={{ fontSize: 'var(--fs-12)' }}>
                    {CATEGORY_LABEL[l.category] ?? l.category}
                    {showReason ? ` · ${l.reasonText}` : ''}
                  </div>
                </td>
                <td className="u-nowrap">{shortDate(l.lineDate)}</td>
                <td className="u-nowrap">{l.paidBy}</td>
                <td className="table__num">
                  <Money value={grossNum} />
                </td>
                <td className="table__num">
                  <Money value={allowedNum} />
                </td>
                <td className="table__num">
                  {disallowedNum > 0 ? (
                    <Money value={disallowedNum} />
                  ) : (
                    <span className="u-subtle">—</span>
                  )}
                </td>
                <td>
                  <VerdictTag verdict={l.policyVerdict} />
                </td>
                <td>
                  {l.proofRef ? (
                    <button
                      type="button"
                      className="proof-pill proof-pill--ref"
                      onClick={() => setSelectedProof(proofPayload)}
                      title="Click to view proof document detail"
                    >
                      <Icon.File size={12} />
                      {l.proofRef}
                    </button>
                  ) : l.sourceDocumentId ? (
                    <button
                      type="button"
                      className="proof-pill proof-pill--email"
                      onClick={() => setSelectedProof(proofPayload)}
                      title="Click to view email proof detail"
                    >
                      <Icon.Inbox size={12} />
                      from email
                    </button>
                  ) : (
                    <span className="badge badge--warn">missing</span>
                  )}
                </td>
                {renderActions ? <td className="u-right">{renderActions(l)}</td> : null}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Proof Document Detail Modal */}
      {selectedProof && (
        <div className="modal-overlay" onClick={() => setSelectedProof(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Proof Document Detail</span>
              <button
                type="button"
                className="btn btn--ghost btn--sm btn--icon"
                onClick={() => setSelectedProof(null)}
              >
                <Icon.Close size={16} />
              </button>
            </div>
            <div className="modal-body">
              <div className="u-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: 'var(--fs-15)' }}>{selectedProof.merchant}</strong>
                <VerdictTag verdict={selectedProof.verdict} />
              </div>

              <div style={{ fontSize: 'var(--fs-13)', color: 'var(--text-muted)' }}>
                <span>{selectedProof.category}</span>
                {selectedProof.lineDate ? ` · ${shortDate(selectedProof.lineDate)}` : ''}
              </div>

              <div className="policy-guide" style={{ marginTop: 8 }}>
                <div className="policy-guide__item">
                  <span className="policy-guide__label">Gross Claimed</span>
                  <Money value={selectedProof.grossAmount} />
                </div>
                <div className="policy-guide__item">
                  <span className="policy-guide__label">Allowed Amount</span>
                  <Money value={selectedProof.allowedAmount} />
                </div>
                {selectedProof.disallowedAmount > 0 && (
                  <div className="policy-guide__item">
                    <span className="policy-guide__label">Disallowed</span>
                    <Money value={selectedProof.disallowedAmount} />
                  </div>
                )}
                <div className="policy-guide__item">
                  <span className="policy-guide__label">Proof Reference</span>
                  <span className="u-mono u-strong">
                    {selectedProof.proofRef ?? 'Email Ingestion (Verified)'}
                  </span>
                </div>
              </div>

              {selectedProof.reasonText && (
                <div className="banner banner--warn" style={{ marginTop: 4, fontSize: 'var(--fs-12)' }}>
                  {selectedProof.reasonText}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <Button size="sm" variant="secondary" onClick={() => setSelectedProof(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
