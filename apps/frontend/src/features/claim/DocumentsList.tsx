import { useEffect, useState } from 'react';
import type { ClaimLine, TripDocument, TripDocumentAttachment } from '../../api/types.js';
import { tripsApi } from '../../api/endpoints.js';
import { deriveDocStatus } from './docStatus.js';
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

/**
 * window.open(blobUrl) forces a download in Chrome/Edge — the new tab has no
 * access to the blob that created it. A direct <a> click navigates the tab
 * itself, so the browser renders it inline instead.
 */
function openInNewTab(url: string) {
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

type AttachmentPreviewState =
  | { status: 'loading' }
  | { status: 'ready'; url: string; mime: string }
  | { status: 'unavailable' };

/** Loads one attachment's bytes as soon as the card renders, so the file is visible without an extra click. */
function useAttachmentPreview(tripId: string, attachmentId: string): AttachmentPreviewState {
  const [state, setState] = useState<AttachmentPreviewState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setState({ status: 'loading' });
    tripsApi
      .attachmentFile(tripId, attachmentId)
      .then((file) => {
        if (cancelled) {
          URL.revokeObjectURL(file.url);
          return;
        }
        objectUrl = file.url;
        setState({ status: 'ready', url: file.url, mime: file.mime });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'unavailable' });
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [tripId, attachmentId]);

  return state;
}

function isImageFile(mime?: string, filename?: string): boolean {
  if (mime?.startsWith('image/')) return true;
  if (filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext && ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'heic'].includes(ext)) return true;
  }
  return false;
}

/** The card's header block: a clean icon tile for all uploaded documents. */
function DocThumb({ doc }: { doc: TripDocument }) {
  return (
    <div className={cx('doc-card__thumb-icon', `doc-card__thumb-icon--${doc.sourceType}`)}>
      {doc.sourceType === 'eml' ? <Icon.Inbox size={28} /> : <Icon.File size={28} />}
    </div>
  );
}

/** A block of extracted text with expand/collapse past 300 chars — shared by attachment OCR text and email body previews. */
function TextPreview({ text, label }: { text: string; label: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 300;
  const shown = expanded || !isLong ? text : `${text.slice(0, 300)}…`;
  return (
    <div>
      <div className="policy-guide__label" style={{ marginBottom: 4 }}>{label}</div>
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
  );
}

function formatBytes(n: number | null): string {
  if (n == null) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function AttachmentPreview({ att, tripId }: { att: TripDocumentAttachment; tripId: string }) {
  const status = OCR_STATUS[att.ocrStatus] ?? { label: att.ocrStatus, tone: 'neutral' as const };
  const text = att.ocrText ?? '';
  const preview = useAttachmentPreview(tripId, att.id);
  const isImage = preview.status === 'ready' && isImageFile(preview.mime, att.filename);
  const isPdf = preview.status === 'ready' && (preview.mime === 'application/pdf' || att.filename.toLowerCase().endsWith('.pdf'));

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

      {preview.status === 'loading' && <Notice tone="info">Loading preview…</Notice>}
      {isImage && <img className="doc-preview-img" src={preview.url} alt={att.filename} />}
      {isPdf && <iframe className="doc-preview-frame" src={preview.url} title={att.filename} />}
      {preview.status === 'ready' && !isImage && !isPdf && (
        <Button size="sm" variant="secondary" onClick={() => openInNewTab(preview.url)}>
          Open this file
        </Button>
      )}
      {preview.status === 'unavailable' && <Notice tone="warn">Could not load a preview for this file.</Notice>}

      {text ? (
        <TextPreview text={text} label="What the system read from this file" />
      ) : (
        <Notice tone="warn">No text could be read from this file.</Notice>
      )}
    </div>
  );
}

/** The ingested inbox for a trip. `grid` lays cards out in responsive columns. */
export function DocumentsList({
  tripId,
  documents,
  claimLines = [],
  onRemove,
  removingId,
  grid,
}: {
  tripId: string;
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

  const selectedStatus = selectedDoc ? deriveDocStatus(selectedDoc, claimLines, documents) : null;
  const selectedLines = selectedDoc ? claimLines.filter((l) => l.sourceDocumentId === selectedDoc.id) : [];

  return (
    <>
      <ul className={cx('doc-list', grid && 'doc-list--grid')}>
        {documents.map((d) => {
          const dimmed = d.isNoise || Boolean(d.isDuplicateOf);
          const status = deriveDocStatus(d, claimLines, documents);
          const confidencePct = d.categoryConfidence ? Math.round(Number(d.categoryConfidence) * 100) : null;
          return (
            <li
              key={d.id}
              className={cx('doc-card', dimmed && 'doc-card--dim')}
              onClick={() => setSelectedDoc(d)}
              title="Click to view document detail"
            >
              <div className="doc-card__thumb">
                <DocThumb doc={d} />
                {onRemove ? (
                  <button
                    type="button"
                    className="doc-card__remove"
                    title="Remove this document"
                    disabled={removingId === d.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(d.id);
                    }}
                  >
                    <Icon.Close size={13} />
                  </button>
                ) : null}
              </div>
              <div className="doc-card__body">
                <Badge tone={status.tone}>{status.label}</Badge>
                <span className="doc-card__title">{d.subject ?? '(no subject)'}</span>
                <span className="doc-card__meta">
                  {d.sourceType === 'eml' ? 'Email' : d.sourceType === 'image' ? 'Image upload' : 'Manual'}
                  {' · '}
                  {CATEGORY_LABEL[d.category] ?? d.category}
                  {confidencePct !== null ? ` (${confidencePct}%)` : ''}
                  {d.fromAddr ? ` · ${d.fromAddr}` : ''}
                  {d.sentAt ? ` · ${shortDate(d.sentAt)}` : ''}
                  {d.attachments.length > 0 ? ` · ${d.attachments.length} file${d.attachments.length > 1 ? 's' : ''}` : ''}
                </span>
                {status.tone === 'warn' ? (
                  <span style={{ fontSize: 'var(--fs-12)', color: 'var(--warn)' }}>{status.detail}</span>
                ) : null}
                {(() => {
                  const snippet = d.parsedJson?.textBody?.trim() || d.attachments.map((a) => a.ocrText).find(Boolean);
                  return snippet ? (
                    <span className="doc-card__snippet">
                      {snippet.length > 160 ? `${snippet.slice(0, 160)}…` : snippet}
                    </span>
                  ) : null;
                })()}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Document Detail Modal */}
      {selectedDoc && selectedStatus && (
        <div className="modal-overlay" onClick={() => setSelectedDoc(null)}>
          <div className="modal-dialog modal-dialog--wide" onClick={(e) => e.stopPropagation()}>
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
                  <span className="policy-guide__label">What happened</span>
                  <Badge tone={selectedStatus.tone}>{selectedStatus.label}</Badge>
                </div>
              </div>

              <Notice tone={selectedStatus.tone === 'warn' ? 'warn' : selectedStatus.tone === 'ok' ? 'info' : 'info'}>
                {selectedStatus.detail}
              </Notice>

              {selectedDoc.sourceType === 'eml' &&
                (selectedDoc.parsedJson?.textBody?.trim() ? (
                  <TextPreview text={selectedDoc.parsedJson.textBody} label="Email content" />
                ) : (
                  <Notice tone="warn">No readable text could be extracted from this email.</Notice>
                ))}

              {selectedDoc.attachments.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div className="policy-guide__label">Attached files ({selectedDoc.attachments.length})</div>
                  {selectedDoc.attachments.map((att) => (
                    <AttachmentPreview key={att.id} att={att} tripId={tripId} />
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
