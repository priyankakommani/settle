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

/** A traveller's own claims. Entry point for raising a travel request. */
export function TripsListPage() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ['trips', 'mine'], queryFn: tripsApi.listMine });

  const goNew = () => navigate('/trips/new');
  const hasTrips = (q.data?.length ?? 0) > 0;

  return (
    <>
      <PageHeader
        eyebrow="Traveller"
        title="My Trips"
        subtitle={`Signed in as ${user.name}`}
        // When the list is empty the call-to-action lives in the middle of the
        // empty state instead — so there's only ever one "New trip" button.
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
        <CardBody flush>
          <AsyncSection
            loading={q.isLoading}
            error={q.error}
            data={q.data}
            isEmpty={(rows) => rows.length === 0}
            empty={
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
      </Card>
    </>
  );
}
