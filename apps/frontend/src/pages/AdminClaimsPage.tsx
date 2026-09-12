import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../api/endpoints.js';
import { PageHeader } from '../ui/PageHeader.js';
import { AsyncSection } from '../ui/AsyncSection.js';
import { Card, CardBody, EmptyState, Notice } from '../ui/primitives.js';
import { Icon } from '../ui/icons.js';
import { Money, StatusPill } from '../ui/domain.js';
import { relativeDay } from '../lib/format.js';
import { TableFilterBar } from '../ui/TableFilterBar.js';
import { PaginationBar } from '../ui/PaginationBar.js';

/** Admin / MD claim register. It intentionally exposes oversight, not approval or payment powers. */
export function AdminClaimsPage() {
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ['admin', 'claims'], queryFn: adminApi.claims });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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
      <PageHeader
        eyebrow="Administration"
        title="Claim register"
        subtitle="Organisation-wide claim oversight. Open any claim to inspect its evidence, policy outcome and approval trail."
      />
      <Notice tone="info">
        <Icon.Admin size={16} />
        <span>Administration is read-only: approval, finance verification and payment stay with their assigned roles.</span>
      </Notice>
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
                <EmptyState icon={<Icon.Trips size={20} />} title="No claims yet">
                  Submitted and draft travel requests will appear here.
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
                <table className="table table--wide">
                  <thead>
                    <tr>
                      <th>Travel request</th>
                      <th>Employee</th>
                      <th>Destination</th>
                      <th className="table__num">Net claim</th>
                      <th>Status</th>
                      <th>Submitted / Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.tripId} className="is-clickable" onClick={() => navigate(`/admin/claims/${row.tripId}`)}>
                        <td className="u-mono">{row.travelRequestId}</td>
                        <td>{row.employeeName}</td>
                        <td>{row.destCity ?? '—'}</td>
                        <td className="table__num">{row.netReimbursable == null ? '—' : <Money value={row.netReimbursable} />}</td>
                        <td><StatusPill status={row.status} /></td>
                        <td className="u-nowrap u-subtle">{relativeDay(row.waitingSince)}</td>
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
