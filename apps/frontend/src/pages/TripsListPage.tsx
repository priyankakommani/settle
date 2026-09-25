import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { tripsApi } from '../api/endpoints.js';
import { useCurrentUser } from '../app/session.js';
import { PageHeader } from '../ui/PageHeader.js';
import { Button, Card, CardBody, EmptyState } from '../ui/primitives.js';
import { AsyncSection } from '../ui/AsyncSection.js';
import { StatusPill } from '../ui/domain.js';
import { Icon } from '../ui/icons.js';
import { shortDate } from '../lib/format.js';
import { TableFilterBar } from '../ui/TableFilterBar.js';
import { PaginationBar } from '../ui/PaginationBar.js';

/** A traveller's own claims. Entry point for raising a travel request. */
export function TripsListPage() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ['trips', 'mine'], queryFn: tripsApi.listMine });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const goNew = () => navigate('/trips/new');
  const rawRows = q.data ?? [];
  const hasTrips = rawRows.length > 0;

  // Ensure most recent items are at the top
  const sortedRows = useMemo(() => {
    return [...rawRows].sort((a, b) => {
      const timeA = new Date(a.createdAt ?? 0).getTime();
      const timeB = new Date(b.createdAt ?? 0).getTime();
      return timeB - timeA;
    });
  }, [rawRows]);

  const filteredRows = useMemo(() => {
    return sortedRows.filter((t) => {
      if (statusFilter !== 'all') {
        const itemStatus = String(t.status || '').toLowerCase().replace(/[\s_]+/g, '');
        const targetFilter = statusFilter.toLowerCase().replace(/[\s_]+/g, '');
        if (itemStatus !== targetFilter) return false;
      }
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchId = t.travelRequestId?.toLowerCase().includes(query);
        const matchCity = t.destCity?.toLowerCase().includes(query);
        if (!matchId && !matchCity) return false;
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
    for (const t of sortedRows) {
      const key = String(t.status || '').toLowerCase();
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
        eyebrow="Traveller"
        title="My Trips"
        subtitle={`Signed in as ${user.name}`}
        actions={
          hasTrips ? (
            <Button variant="primary" onClick={goNew}>
              <Icon.Plus size={16} />
              New trip
            </Button>
          ) : null
        }
      />

      <Card>
        {hasTrips && (
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
            isEmpty={() => hasTrips && filteredRows.length === 0}
            empty={
              !hasTrips ? (
                <EmptyState
                  icon={<Icon.Trips size={20} />}
                  title="No travel requests yet"
                  action={
                    <Button variant="primary" onClick={goNew}>
                      <Icon.Plus size={16} />
                      New trip
                    </Button>
                  }
                >
                  Raise a travel request before booking. Settle then builds the settlement claim from
                  your inbox.
                </EmptyState>
              ) : (
                <EmptyState icon={<Icon.Search size={20} />} title="No matching trips found">
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
                      <th>Destination</th>
                      <th>Dates</th>
                      <th>Status</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((t) => (
                      <tr
                        key={t.id}
                        className="is-clickable"
                        onClick={() => navigate(`/trips/${t.id}`)}
                      >
                        <td>
                          <Link to={`/trips/${t.id}`} className="u-mono">
                            {t.travelRequestId}
                          </Link>
                        </td>
                        <td>{t.destCity ?? '—'}</td>
                        <td className="u-nowrap">
                          {shortDate(t.startDate)} – {shortDate(t.endDate)}
                        </td>
                        <td>
                          <StatusPill status={t.status} />
                        </td>
                        <td className="u-nowrap u-subtle">{shortDate(t.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </AsyncSection>
        </CardBody>

        {hasTrips && filteredRows.length > 0 && (
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
