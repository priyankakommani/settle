import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../api/endpoints.js';
import { PageHeader } from '../ui/PageHeader.js';
import { AsyncSection } from '../ui/AsyncSection.js';
import { Card, CardBody, EmptyState, Notice } from '../ui/primitives.js';
import { Icon } from '../ui/icons.js';
import { Money, StatusPill } from '../ui/domain.js';
import { relativeDay } from '../lib/format.js';

/** Admin / MD claim register. It intentionally exposes oversight, not approval or payment powers. */
export function AdminClaimsPage() {
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ['admin', 'claims'], queryFn: adminApi.claims });

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
        <CardBody flush>
          <AsyncSection
            loading={q.isLoading}
            error={q.error}
            data={q.data}
            isEmpty={(rows) => rows.length === 0}
            empty={<EmptyState icon={<Icon.Trips size={20} />} title="No claims yet">Submitted and draft travel requests will appear here.</EmptyState>}
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
                      <th>Submitted</th>
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
      </Card>
    </>
  );
}
