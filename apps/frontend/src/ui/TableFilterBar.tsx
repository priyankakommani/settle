import { Input } from './form.js';
import { Button } from './primitives.js';
import { Icon } from './icons.js';

export interface StatusOption {
  value: string;
  label: string;
}

export interface FilterBarProps {
  search: string;
  onSearchChange: (search: string) => void;
  status: string;
  onStatusChange: (status: string) => void;
  statusOptions?: StatusOption[];
  statusCounts?: Record<string, number>;
}

const DEFAULT_STATUS_OPTIONS: StatusOption[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending_approval', label: 'Pending Approval' },
  { value: 'pending_finance', label: 'Pending Finance' },
  { value: 'verified', label: 'Verified' },
  { value: 'paid', label: 'Paid' },
  { value: 'returned', label: 'Returned' },
  { value: 'rejected', label: 'Rejected' },
];

export function TableFilterBar({
  search,
  onSearchChange,
  status,
  onStatusChange,
  statusOptions = DEFAULT_STATUS_OPTIONS,
  statusCounts,
}: FilterBarProps) {
  const hasFilter = search.trim().length > 0 || status !== 'all';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '14px 16px',
        background: 'var(--surface-2, #f8fafc)',
        borderBottom: '1px solid var(--border, #e2e8f0)',
        borderRadius: 'var(--radius-md, 8px) var(--radius-md, 8px) 0 0',
      }}
    >
      {/* Top row: Search input + Clear filter button + Count summary */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ position: 'relative', minWidth: '240px', flex: '1 1 300px' }}>
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Filter by Travel Request ID, Employee, Destination..."
            style={{
              paddingLeft: '34px',
              paddingRight: search ? '30px' : '12px',
              fontSize: '13px',
              height: '36px',
              width: '100%',
              borderRadius: '20px',
              background: 'var(--surface, #ffffff)',
              borderColor: 'var(--border, #cbd5e1)',
            }}
          />
          <span
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted, #94a3b8)',
              pointerEvents: 'none',
              display: 'flex',
            }}
          >
            <Icon.Search size={15} />
          </span>
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted, #94a3b8)',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                borderRadius: '50%',
              }}
              title="Clear search"
            >
              <Icon.Close size={14} />
            </button>
          )}
        </div>

        {hasFilter && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              onSearchChange('');
              onStatusChange('all');
            }}
            style={{ fontSize: '12px', height: '32px' }}
          >
            <Icon.Close size={12} /> Clear all filters
          </Button>
        )}
      </div>

      {/* Bottom row: Interactive Status Pill Tabs */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
          alignItems: 'center',
          paddingTop: '2px',
        }}
      >
        <span
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--text-muted, #64748b)',
            marginRight: '4px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          Status:
        </span>
        {statusOptions.map((opt) => {
          const isSelected = status === opt.value;
          const count = statusCounts ? statusCounts[opt.value] : undefined;

          // Don't show options with 0 items unless it's "all" or currently selected
          if (count === 0 && !isSelected && opt.value !== 'all') {
            return null;
          }

          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onStatusChange(opt.value)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                borderRadius: '16px',
                fontSize: '12px',
                fontWeight: isSelected ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s ease-in-out',
                border: isSelected ? '1px solid var(--primary, #2563eb)' : '1px solid var(--border, #e2e8f0)',
                background: isSelected ? 'var(--primary, #2563eb)' : 'var(--surface, #ffffff)',
                color: isSelected ? '#ffffff' : 'var(--text, #334155)',
                boxShadow: isSelected ? '0 1px 3px rgba(37,99,235,0.25)' : 'none',
              }}
            >
              <span>{opt.label}</span>
              {count !== undefined && (
                <span
                  style={{
                    display: 'inline-block',
                    padding: '1px 6px',
                    borderRadius: '10px',
                    fontSize: '11px',
                    fontWeight: 600,
                    background: isSelected ? 'rgba(255,255,255,0.25)' : 'var(--surface-2, #f1f5f9)',
                    color: isSelected ? '#ffffff' : 'var(--text-muted, #64748b)',
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
