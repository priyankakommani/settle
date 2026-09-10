import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '../api/endpoints.js';
import { useCurrentUser } from '../app/session.js';
import { AnalyticsDashboard } from '../features/analytics/AnalyticsDashboard.js';
import type { AnalyticsOverview } from '../api/types.js';
import { AsyncSection } from '../ui/AsyncSection.js';
import { PageHeader } from '../ui/PageHeader.js';

const COPY: Record<AnalyticsOverview['scope'], { eyebrow: string; title: string; subtitle: string }> = {
  employee: {
    eyebrow: 'Personal analytics',
    title: 'My expense overview',
    subtitle: 'Your claims, reimbursement progress and policy outcomes in one place.',
  },
  approver: {
    eyebrow: 'Approver analytics',
    title: 'Approval overview',
    subtitle: 'Your current workload, decisions and claims moving through your review path.',
  },
  finance: {
    eyebrow: 'Finance analytics',
    title: 'Finance overview',
    subtitle: 'Verification workload, payments and policy exceptions across the organisation.',
  },
  org: {
    eyebrow: 'Organisation analytics',
    title: 'Organisation overview',
    subtitle: 'Live travel-spend, reimbursement and claim-pipeline insight across Nortex.',
  },
};

/** Dashboard data is scoped server-side to the signed-in role, never filtered only in the browser. */
export function AnalyticsPage() {
  const user = useCurrentUser();
  const q = useQuery({ queryKey: ['analytics', 'overview'], queryFn: analyticsApi.overview });

  const copy = q.data ? COPY[q.data.scope] : {
    eyebrow: 'Analytics', title: 'Your overview', subtitle: `Preparing insights for ${user.name}.`,
  };

  return (
    <>
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} subtitle={copy.subtitle} />
      <AsyncSection loading={q.isLoading} error={q.error} data={q.data} skeletonRows={8}>
        {(overview) => <AnalyticsDashboard overview={overview} />}
      </AsyncSection>
    </>
  );
}
