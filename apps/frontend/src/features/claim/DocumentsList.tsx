import { useState } from 'react';
import type { ClaimLine, TripDocument, TripDocumentAttachment } from '../../api/types.js';
import { Badge, Button, EmptyState, Notice, cx } from '../../ui/primitives.js';
import { VerdictTag } from '../../ui/domain.js';
import { Icon } from '../../ui/icons.js';
import { shortDate } from '../../lib/format.js';

const CATEGORY_LABEL: Record<string, string> = {
  travel_approval: 'Travel approval',
  advance: 'Advance',
  flight: 'Flight',
  hotel_booking: 'Hotel booking',
  hotel_invoice: 'Hotel invoice',
  cab: 'Cab',
  meal: 'Meal',
  business_entertainment: 'Business entertainment',
  noise: 'Ignored',
  unknown: 'Unclassified',
};

const CLAIM_CATEGORY_LABEL: Record<string, string> = {
  lodging: 'Lodging',
  conveyance: 'Conveyance',
  meal: 'Meals',
  business_entertainment: 'Business entertainment',
  other: 'Other',
};

const OCR_STATUS: Record<string, { label: string; tone: 'ok' | 'warn' | 'neutral' }> = {
  done: { label: 'Read successfully', tone: 'ok' },
  failed: { label: 'Could not read this file', tone: 'warn' },
  skipped: { label: 'Not a readable image type', tone: 'neutral' },
  pending: { label: 'Not processed yet', tone: 'neutral' },
};

interface DocStatus {
  tone: 'ok' | 'warn' | 'info' | 'neutral';
  label: string;
  detail: string;
}

/** A clear, honest explanation of what happened to this document — for both the uploader and whoever reviews it later. */
function deriveStatus(doc: TripDocument, claimLines: ClaimLine[], allDocs: TripDocument[]): DocStatus {
  if (doc.isDuplicateOf) {
    const original = allDocs.find((d) => d.id === doc.isDuplicateOf);
    return {
      tone: 'neutral',
      label: 'Duplicate',
      detail: original
        ? `Matches an expense already captured from "${original.subject ?? 'another document'}" — not double-counted.`
        : 'Matches an expense already captured from another document — not double-counted.',
    };
  }
  if (doc.isNoise) {
    return {
      tone: 'neutral',
      label: 'Ignored',
      detail: 'Classified as promotional mail or a failed-payment notice — not a real expense or trip event.',
    };
  }
  const produced = claimLines.filter((l) => l.sourceDocumentId === doc.id);
  if (produced.length > 0) {
    return {
      tone: 'ok',
      label: `${produced.length} claim line${produced.length > 1 ? 's' : ''}`,
      detail: `Automatically produced ${produced.length} claim line${produced.length > 1 ? 's' : ''} from this document.`,
    };
  }
  switch (doc.category) {
    case 'travel_approval':
      return {
        tone: 'info',
        label: 'Trip context',
        detail: "Used to fill in the trip's dates/destination/approver — not a claim line by itself.",
      };
    case 'advance':
      return {
        tone: 'info',
        label: 'Advance applied',
        detail: "Updated the trip's advance amount/reference — not a claim line by itself.",
      };
    case 'hotel_booking':
      return {
        tone: 'info',
        label: 'Booking only',
        detail: 'A "pay at hotel" confirmation, not proof of payment — the hotel\'s tax invoice produces the actual lodging line.',
      };
    default:
      return {
        tone: 'warn',
        label: 'No claim line',
        detail: "Couldn't automatically read an amount/category from this document — check the attachment preview below, then add the expense manually.",
      };
  }
}

function formatBytes(n: number | null): string {
  if (n == null) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function AttachmentPreview({ att }: { att: TripDocumentAttachment }) {
  const [expanded, setExpanded] = useState(false);
  const status = OCR_STATUS[att.ocrStatus] ?? { label: att.ocrStatus, tone: 'neutral' as const };
  const text = att.ocrText ?? '';
  const isLong = text.length > 300;
  const shown = expanded || !isLong ? text : `${text.slice(0, 300)}…`;

  return (
    <div className="policy-guide" style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', padding: 10 }}>
      <div className="policy-guide__item">
        <span className="policy-guide__label">File</span>
        <span className="u-strong">{att.filename}</span>
      </div>
      <div className="policy-guide__item">
        <span className="policy-guide__label">Type / size</span>
        <span>{att.mime} · {formatBytes(att.sizeBytes)}</span>
      </div>
      <div className="policy-guide__item">
        <span className="policy-guide__label">OCR result</span>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      {text ? (
        <div style={{ marginTop: 4 }}>
          <div className="policy-guide__label" style={{ marginBottom: 4 }}>What the system read from this file</div>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: 8,
              margin: 0,
            }}
          >
            {shown}
          </pre>
          {isLong ? (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              style={{ marginTop: 4 }}
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? 'Show less' : 'Show full text'}
            </button>
          ) : null}
        </div>
      ) : (
        <Notice tone="warn">No text could be read from this file.</Notice>
      )}
    </div>
  );
}

/** The ingested inbox for a trip. `grid` lays cards out in responsive columns. */
export function DocumentsList({
  documents,
  claimLines = [],
  onRemove,
  removingId,
  grid,
}: {
  documents: TripDocument[];
  claimLines?: ClaimLine[];
  onRemove?: (id: string) => void;
  removingId?: string | null;
  grid?: boolean;
}) {
  const [selectedDoc, setSelectedDoc] = useState<TripDocument | null>(null);

  if (documents.length === 0) {
    return (
      <EmptyState icon={<Icon.Inbox size={20} />} title="No documents ingested">
        Upload the trip's emails and receipts to build the claim.
      </EmptyState>
    );
  }

  const selectedStatus = selectedDoc ? deriveStatus(selectedDoc, claimLines, documents) : null;
  const selectedLines = selectedDoc ? claimLines.filter((l) => l.sourceDocumentId === selectedDoc.id) : [];

  return (
    <>
      <ul className={cx('doc-list', grid && 'doc-list--grid')}>
        {documents.map((d) => {
          const dimmed = d.isNoise || Boolean(d.isDuplicateOf);
          const status = deriveStatus(d, claimLines, documents);
          const confidencePct = d.categoryConfidence ? Math.round(Number(d.categoryConfidence) * 100) : null;
          return (
            <li
              key={d.id}
              className={cx('doc-item', dimmed && 'doc-item--dim')}
              onClick={() => setSelectedDoc(d)}
              style={{ cursor: 'pointer' }}
              title="Click to view document detail"
            >
              <Icon.File size={16} />
              <div className="doc-item__body">
                <span className="doc-item__title">{d.subject ?? '(no subject)'}</span>
                <span className="doc-item__meta">
                  {d.sourceType === 'eml' ? 'Email' : d.sourceType === 'image' ? 'Image upload' : 'Manual'}
                  {' · '}
                  {CATEGORY_LABEL[d.category] ?? d.category}
                  {confidencePct !== null ? ` (${confidencePct}%)` : ''}
                  {d.fromAddr ? ` · ${d.fromAddr}` : ''}
                  {d.sentAt ? ` · ${shortDate(d.sentAt)}` : ''}
                  {d.attachments.length > 0 ? ` · ${d.attachments.length} file${d.attachments.length > 1 ? 's' : ''}` : ''}
                </span>
              </div>
              <Badge tone={status.tone}>{status.label}</Badge>
              {onRemove ? (
                <button
                  type="button"
                  className="btn btn--ghost btn--sm btn--icon"
                  title="Remove this document"
                  disabled={removingId === d.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(d.id);
                  }}
                >
                  <Icon.Close size={14} />
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>

      {/* Document Detail Modal */}
      {selectedDoc && selectedStatus && (
        <div className="modal-overlay" onClick={() => setSelectedDoc(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Ingested document</span>
              <button
                type="button"
                className="btn btn--ghost btn--sm btn--icon"
                onClick={() => setSelectedDoc(null)}
              >
                <Icon.Close size={16} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <strong style={{ fontSize: 'var(--fs-15)' }}>{selectedDoc.subject ?? '(no subject)'}</strong>

              <div className="policy-guide">
                <div className="policy-guide__item">
                  <span className="policy-guide__label">Source</span>
                  <span className="u-strong">
                    {selectedDoc.sourceType === 'eml' ? 'Uploaded email (.eml)' : selectedDoc.sourceType === 'image' ? 'Uploaded receipt image' : 'Manual entry'}
                  </span>
                </div>
                {selectedDoc.fromAddr && (
                  <div className="policy-guide__item">
                    <span className="policy-guide__label">Sender</span>
                    <span>{selectedDoc.fromAddr}</span>
                  </div>
                )}
                {selectedDoc.sentAt && (
                  <div className="policy-guide__item">
                    <span className="policy-guide__label">Sent</span>
                    <span>{shortDate(selectedDoc.sentAt)}</span>
                  </div>
                )}
                <div className="policy-guide__item">
                  <span className="policy-guide__label">Uploaded</span>
                  <span>{shortDate(selectedDoc.createdAt)}</span>
                </div>
                <div className="policy-guide__item">
                  <span className="policy-guide__label">Classified as</span>
                  <span className="u-strong">
                    {CATEGORY_LABEL[selectedDoc.category] ?? selectedDoc.category}
                    {selectedDoc.categoryConfidence
                      ? ` (${Math.round(Number(selectedDoc.categoryConfidence) * 100)}% confidence)`
                      : ''}
                  </span>
                </div>
                <div className="policy-guide__item">
                  <span className="policy-guide__label">What happened</span>
                  <Badge tone={selectedStatus.tone}>{selectedStatus.label}</Badge>
                </div>
              </div>

              <Notice tone={selectedStatus.tone === 'warn' ? 'warn' : selectedStatus.tone === 'ok' ? 'info' : 'info'}>
                {selectedStatus.detail}
              </Notice>

              {selectedDoc.attachments.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div className="policy-guide__label">Attached files ({selectedDoc.attachments.length})</div>
                  {selectedDoc.attachments.map((att) => (
                    <AttachmentPreview key={att.id} att={att} />
                  ))}
                </div>
              )}

              {selectedLines.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div className="policy-guide__label">Claim lines produced</div>
                  {selectedLines.map((l) => (
                    <div key={l.id} className="policy-guide__item">
                      <span>
                        {l.merchant ?? CLAIM_CATEGORY_LABEL[l.category] ?? l.category}
                        <span className="u-subtle"> · {CLAIM_CATEGORY_LABEL[l.category] ?? l.category}</span>
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="u-mono">
                          {l.currency === 'INR' ? '₹' : `${l.currency} `}
                          {Number(l.grossAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <VerdictTag verdict={l.policyVerdict} />
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <Button size="sm" variant="secondary" onClick={() => setSelectedDoc(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
