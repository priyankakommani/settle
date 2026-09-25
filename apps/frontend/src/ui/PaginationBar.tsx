import { Button } from './primitives.js';
import { Select } from './form.js';

export interface PaginationBarProps {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
}

export function PaginationBar({
  currentPage,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
}: PaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endIndex = Math.min(totalItems, currentPage * pageSize);

  const canPrev = currentPage > 1;
  const canNext = currentPage < totalPages;

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        background: 'var(--surface-2, #f8fafc)',
        borderTop: '1px solid var(--border, #e2e8f0)',
        borderRadius: '0 0 var(--radius-md, 8px) var(--radius-md, 8px)',
        fontSize: '13px',
      }}
    >
      <div style={{ color: 'var(--text-muted, #64748b)', fontSize: '13px' }}>
        {totalItems > 0 ? (
          <>
            Showing <strong>{startIndex}–{endIndex}</strong> of <strong>{totalItems}</strong> requests
          </>
        ) : (
          'No requests to display'
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        {onPageSizeChange && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)' }}>Per page:</span>
            <Select
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(1);
              }}
              style={{ fontSize: '12px', padding: '2px 8px', height: '28px' }}
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </Select>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)', marginRight: '4px' }}>
            Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
          </span>

          <Button
            size="sm"
            variant="secondary"
            disabled={!canPrev}
            onClick={() => onPageChange(currentPage - 1)}
            style={{ fontSize: '12px', height: '30px', padding: '0 10px' }}
          >
            Previous
          </Button>

          <Button
            size="sm"
            variant="secondary"
            disabled={!canNext}
            onClick={() => onPageChange(currentPage + 1)}
            style={{ fontSize: '12px', height: '30px', padding: '0 10px' }}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
