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

type Area = 'approvals' | 'finance';

const COPY: Record<Area, { eyebrow: string; title: string; subtitle: string; empty: string }> = {
  approvals: {
    eyebrow: 'Approver',
    title: 'Approvals',
    subtitle: 'Claims waiting on your decision.',
    empty: 'Nothing is waiting on you right now.',
  },
  finance: {
    eyebrow: 'Finance',
    title: 'Finance queue',
    subtitle: 'Verified business approvals ready for finance processing.',
    empty: 'No claims are with finance right now.',
  },
};

/** Shared work-queue screen for approvers and finance. */
export function QueuePage({ area }: { area: Area }) {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const copy = COPY[area];

  const q = useQuery({
    queryKey: ['queue', area],
    queryFn: area === 'approvals' ? approvalsApi.queue : financeApi.queue,
  });

  return (
    <>
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} subtitle={`${copy.subtitle} · ${user.name}`} />

      <Card>
        <CardBody flush>
          <AsyncSection
            loading={q.isLoading}
            error={q.error}
            data={q.data}
            isEmpty={(rows) => rows.length === 0}
            empty={<EmptyState icon={<Icon.Approvals size={20} />} title="All clear">{copy.empty}</EmptyState>}
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
                      <th>Waiting</th>
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
      </Card>
    </>
  );
}
