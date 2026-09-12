import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { approvalsApi, financeApi } from '../api/endpoints.js';
import { useCurrentUser } from '../app/session.js';
import { PageHeader } from '../ui/PageHeader.js';
import { Card, CardBody, EmptyState } from '../ui/primitives.js';
import { AsyncSection } from '../ui/AsyncSection.js';
import { Money, StatusPill } from '../ui/domain.js';
import { Icon } from '../ui/icons.js';
import { relativeDay } from '../lib/format.js';
import { TableFilterBar } from '../ui/TableFilterBar.js';
import { PaginationBar } from '../ui/PaginationBar.js';

type Area = 'approvals' | 'finance';

const COPY: Record<Area, { eyebrow: string; title: string; subtitle: string; empty: string }> = {
  approvals: {
    eyebrow: 'Approver',
    title: 'Approvals',
    subtitle: 'Claims awaiting your decision and claims previously approved/acted on.',
    empty: 'No claims in your approval register right now.',
  },
  finance: {
    eyebrow: 'Finance',
    title: 'Finance queue',
    subtitle: 'Claims for finance verification, processing, and payout history.',
    empty: 'No claims in the finance queue right now.',
  },
};

/** Shared work-queue screen for approvers and finance. */
export function QueuePage({ area }: { area: Area }) {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const copy = COPY[area];

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const q = useQuery({
    queryKey: ['queue', area],
    queryFn: area === 'approvals' ? approvalsApi.queue : financeApi.queue,
  });

  const rawRows = q.data ?? [];
  const hasRows = rawRows.length > 0;

  // Ensure most recent items are at the top
  const sortedRows = useMemo(() => {
    return [...rawRows].sort((a, b) => {
      const timeA = new Date(a.waitingSince ?? 0).getTime();
      const timeB = new Date(b.waitingSince ?? 0).getTime();
      return timeB - timeA;
    });
  }, [rawRows]);

  const filteredRows = useMemo(() => {
    return sortedRows.filter((r) => {
      if (statusFilter !== 'all') {
        const itemStatus = String(r.status || '').toLowerCase().replace(/[\s_]+/g, '');
        const targetFilter = statusFilter.toLowerCase().replace(/[\s_]+/g, '');
        if (itemStatus !== targetFilter) return false;
      }
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchId = r.travelRequestId?.toLowerCase().includes(query);
        const matchEmp = r.employeeName?.toLowerCase().includes(query);
        const matchCity = r.destCity?.toLowerCase().includes(query);
        if (!matchId && !matchEmp && !matchCity) return false;
      }
      return true;
    });
  }, [sortedRows, statusFilter, search]);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: sortedRows.length };
    for (const r of sortedRows) {
      const key = String(r.status || '').toLowerCase();
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [sortedRows]);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setCurrentPage(1);
  };

  const handleStatusChange = (val: string) => {
    setStatusFilter(val);
    setCurrentPage(1);
  };

  return (
    <>
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} subtitle={`${copy.subtitle} · ${user.name}`} />

      <Card>
        {hasRows && (
          <TableFilterBar
            search={search}
            onSearchChange={handleSearchChange}
            status={statusFilter}
            onStatusChange={handleStatusChange}
            statusCounts={statusCounts}
          />
        )}
        <CardBody flush>
          <AsyncSection
            loading={q.isLoading}
            error={q.error}
            data={paginatedRows}
            isEmpty={() => hasRows && filteredRows.length === 0}
            empty={
              !hasRows ? (
                <EmptyState icon={<Icon.Approvals size={20} />} title="All clear">
                  {copy.empty}
                </EmptyState>
              ) : (
                <EmptyState icon={<Icon.Search size={20} />} title="No matching claims found">
                  Try adjusting your search terms or status filter.
                </EmptyState>
              )
            }
          >
            {(rows) => (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Travel request</th>
                      <th>Employee</th>
                      <th>Destination</th>
                      <th className="table__num">Net claim</th>
                      <th>Status</th>
                      <th>Waiting / Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr
                        key={r.tripId}
                        className="is-clickable"
                        onClick={() => navigate(`/${area}/${r.tripId}`)}
                      >
                        <td className="u-mono">{r.travelRequestId}</td>
                        <td>{r.employeeName}</td>
                        <td>{r.destCity ?? '—'}</td>
                        <td className="table__num">
                          {r.netReimbursable != null ? <Money value={r.netReimbursable} /> : '—'}
                        </td>
                        <td>
                          <StatusPill status={r.status} />
                        </td>
                        <td className="u-nowrap u-subtle">{relativeDay(r.waitingSince)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </AsyncSection>
        </CardBody>

        {hasRows && filteredRows.length > 0 && (
          <PaginationBar
            currentPage={currentPage}
            pageSize={pageSize}
            totalItems={filteredRows.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        )}
      </Card>
    </>
  );
}
