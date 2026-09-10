import { useState } from 'react';
import type { TripDocument } from '../../api/types.js';
import { Button, EmptyState, cx } from '../../ui/primitives.js';
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

/** The ingested inbox for a trip. `grid` lays cards out in responsive columns. */
export function DocumentsList({
  documents,
  onRemove,
  removingId,
  grid,
}: {
  documents: TripDocument[];
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

  return (
    <>
      <ul className={cx('doc-list', grid && 'doc-list--grid')}>
        {documents.map((d) => {
          const dimmed = d.isNoise || Boolean(d.isDuplicateOf);
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
                  {CATEGORY_LABEL[d.category] ?? d.category}
                  {d.fromAddr ? ` · ${d.fromAddr}` : ''}
                  {d.sentAt ? ` · ${shortDate(d.sentAt)}` : ''}
                </span>
              </div>
              {d.isDuplicateOf ? <span className="badge badge--warn">duplicate</span> : null}
              {d.isNoise ? <span className="badge badge--neutral">ignored</span> : null}
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
      {selectedDoc && (
        <div className="modal-overlay" onClick={() => setSelectedDoc(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Ingested Document Overview</span>
              <button
                type="button"
                className="btn btn--ghost btn--sm btn--icon"
                onClick={() => setSelectedDoc(null)}
              >
                <Icon.Close size={16} />
              </button>
            </div>
            <div className="modal-body">
              <strong style={{ fontSize: 'var(--fs-15)' }}>{selectedDoc.subject ?? '(no subject)'}</strong>

              <div className="policy-guide" style={{ marginTop: 8 }}>
                <div className="policy-guide__item">
                  <span className="policy-guide__label">Category</span>
                  <span className="u-strong">{CATEGORY_LABEL[selectedDoc.category] ?? selectedDoc.category}</span>
                </div>
                {selectedDoc.fromAddr && (
                  <div className="policy-guide__item">
                    <span className="policy-guide__label">Sender</span>
                    <span>{selectedDoc.fromAddr}</span>
                  </div>
                )}
                {selectedDoc.sentAt && (
                  <div className="policy-guide__item">
                    <span className="policy-guide__label">Ingestion Date</span>
                    <span>{shortDate(selectedDoc.sentAt)}</span>
                  </div>
                )}
                <div className="policy-guide__item">
                  <span className="policy-guide__label">Ingestion Status</span>
                  <span className="badge badge--ok">Ingested & Policy Evaluated</span>
                </div>
              </div>
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
