import { sql, type SQL } from 'drizzle-orm';
import { AnalyticsScope, EmployeeRole, type AnalyticsScopeValue } from '@settle/shared';
import { db } from '../db/index.js';
import { mapDbError } from '../lib/db-error.js';
import type { Employee } from '../db/schema/index.js';

/* ------------------------------------------------------------------ *
 * Payload shapes (mirrored by the frontend in api/types.ts)         *
 * ------------------------------------------------------------------ */

export type KpiUnit = 'inr' | 'count' | 'days' | 'pct';
export interface Kpi {
  key: string;
  label: string;
  value: number;
  unit: KpiUnit;
  tone?: 'ok' | 'warn' | 'danger' | 'accent' | 'neutral';
  hint?: string;
}
export interface StatusSlice {
  status: string;
  count: number;
  value: number;
}
export interface MonthPoint {
  month: string; // YYYY-MM
  claims: number;
  value: number;
  paidClaims: number;
  paidValue: number;
}
export interface CategorySlice {
  category: string;
  allowed: number;
  disallowed: number;
}
export interface DecisionSlice {
  decision: string;
  count: number;
}
export interface SpenderRow {
  employeeCode: string;
  name: string;
  trips: number;
  value: number;
}
export interface ReasonRow {
  reasonCode: string;
  count: number;
  amount: number;
}

export interface OverviewPayload {
  scope: AnalyticsScopeValue;
  generatedAt: string;
  kpis: Kpi[];
  statusBreakdown: StatusSlice[];
  monthly: MonthPoint[];
  categoryBreakdown: CategorySlice[];
  decisions?: DecisionSlice[];
  topSpenders?: SpenderRow[];
  disallowReasons?: ReasonRow[];
}

/* ------------------------------------------------------------------ */

type Row = Record<string, unknown>;
function rows(result: unknown): Row[] {
  const r = result as { rows?: Row[] };
  return Array.isArray(r) ? (r as Row[]) : (r?.rows ?? []);
}
const num = (v: unknown): number => {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
};

export function scopeForRole(role: string): AnalyticsScopeValue {
  if (role === EmployeeRole.ADMIN || role === EmployeeRole.MD) return AnalyticsScope.ORG;
  if (role === EmployeeRole.FINANCE) return AnalyticsScope.FINANCE;
  if (
    role === EmployeeRole.REPORTING_MANAGER ||
    role === EmployeeRole.HEAD_OF_DEPARTMENT ||
    role === EmployeeRole.HEAD_OF_DIVISION
  ) {
    return AnalyticsScope.APPROVER;
  }
  return AnalyticsScope.EMPLOYEE;
}

export const analyticsService = {
  async overview(user: Employee): Promise<OverviewPayload> {
    const scope = scopeForRole(user.role);
    try {
      switch (scope) {
        case AnalyticsScope.EMPLOYEE:
          return await employeeOverview(user.empCode);
        case AnalyticsScope.APPROVER:
          return await approverOverview(user.empCode);
        case AnalyticsScope.FINANCE:
          return await financeOverview();
        default:
          return await orgOverview();
      }
    } catch (err) {
      throw mapDbError(err);
    }
  },
};

export type AnalyticsService = typeof analyticsService;

/* ------------------------------------------------------------------ *
 * Shared query fragments — `where` is a full `WHERE ...` clause or   *
 * an empty fragment.                                                *
 * ------------------------------------------------------------------ */

async function statusBreakdown(where = sql``): Promise<StatusSlice[]> {
  const res = await db.execute(sql`
    select t.status,
           count(*)::int as count,
           coalesce(sum(s.net_reimbursable), 0) as value
    from trips t
    left join settlements s on s.trip_id = t.id
    ${where}
    group by t.status
    order by count desc
  `);
  return rows(res).map((r) => ({
    status: String(r.status),
    count: num(r.count),
    value: num(r.value),
  }));
}

async function monthlySeries(where = sql``): Promise<MonthPoint[]> {
  const res = await db.execute(sql`
    select to_char(coalesce(t.submitted_at, t.created_at), 'YYYY-MM') as month,
           count(*)::int as claims,
           coalesce(sum(s.net_reimbursable), 0) as value,
           count(*) filter (where t.status = 'PAID')::int as paid_claims,
           coalesce(sum(s.amount_payable) filter (where t.status = 'PAID'), 0) as paid_value
    from trips t
    left join settlements s on s.trip_id = t.id
    ${where}
    group by 1
    order by 1
  `);
  return rows(res)
    .filter((r) => r.month)
    .map((r) => ({
      month: String(r.month),
      claims: num(r.claims),
      value: num(r.value),
      paidClaims: num(r.paid_claims),
      paidValue: num(r.paid_value),
    }))
    .slice(-9);
}

async function categoryBreakdown(where = sql``): Promise<CategorySlice[]> {
  const res = await db.execute(sql`
    select cl.category,
           coalesce(sum(cl.allowed_amount), 0) as allowed,
           coalesce(sum(cl.disallowed_amount), 0) as disallowed
    from claim_lines cl
    join trips t on t.id = cl.trip_id
    ${where}
    group by cl.category
    order by allowed desc
  `);
  return rows(res).map((r) => ({
    category: String(r.category),
    allowed: num(r.allowed),
    disallowed: num(r.disallowed),
  }));
}

async function scalar(query: SQL): Promise<number> {
  const res = await db.execute(query);
  const r = rows(res)[0];
  return r ? num(Object.values(r)[0]) : 0;
}

/* ------------------------------------------------------------------ *
 * Per-scope assembly                                                *
 * ------------------------------------------------------------------ */

async function employeeOverview(code: string): Promise<OverviewPayload> {
  const w = sql`where t.employee_code = ${code}`;
  const [status, monthly, categories] = await Promise.all([
    statusBreakdown(w),
    monthlySeries(w),
    categoryBreakdown(w),
  ]);

  const totals = rows(
    await db.execute(sql`
      select
        count(*)::int as trips,
        count(*) filter (
          where t.status in ('PENDING_APPROVAL', 'RETURNED', 'PENDING_FINANCE', 'VERIFIED')
        )::int as in_progress,
        coalesce(sum(s.net_reimbursable), 0) as net_total,
        coalesce(sum(s.total_disallowed), 0) as disallowed_total,
        coalesce(sum(s.amount_payable) filter (where t.status <> 'PAID'), 0) as awaiting_pay,
        coalesce(sum(s.advance_drawn), 0) as advance_total
      from trips t
      left join settlements s on s.trip_id = t.id
      where t.employee_code = ${code}
    `),
  )[0] as Row;

  const kpis: Kpi[] = [
    { key: 'trips', label: 'My travel requests', value: num(totals.trips), unit: 'count' },
    {
      key: 'in_progress',
      label: 'In progress',
      value: num(totals.in_progress),
      unit: 'count',
      tone: 'accent',
    },
    {
      key: 'net',
      label: 'Net reimbursable (all time)',
      value: num(totals.net_total),
      unit: 'inr',
    },
    {
      key: 'awaiting',
      label: 'Awaiting payment',
      value: num(totals.awaiting_pay),
      unit: 'inr',
      tone: 'warn',
    },
    {
      key: 'disallowed',
      label: 'Disallowed (all time)',
      value: num(totals.disallowed_total),
      unit: 'inr',
      tone: 'danger',
    },
    {
      key: 'advance',
      label: 'Advance drawn',
      value: num(totals.advance_total),
      unit: 'inr',
      tone: 'neutral',
    },
  ];

  return frame(AnalyticsScope.EMPLOYEE, kpis, status, monthly, categories);
}

async function approverOverview(code: string): Promise<OverviewPayload> {
  // trips this person has touched, for the status / category context
  const touched = sql`where t.id in (select trip_id from approvals where approver_code = ${code})`;
  const touchedCat = sql`where t.id in (select trip_id from approvals where approver_code = ${code})`;

  const [status, monthly, categories, decisionRows] = await Promise.all([
    statusBreakdown(touched),
    monthlySeries(touched),
    categoryBreakdown(touchedCat),
    db.execute(sql`
      select a.decision, count(*)::int as count
      from approvals a
      where a.approver_code = ${code} and a.decision <> 'pending'
      group by a.decision
    `),
  ]);

  const pendingOnMe = await scalar(sql`
    select count(*)::int
    from approvals a
    join trips t on t.id = a.trip_id
    where a.approver_code = ${code}
      and a.decision = 'pending'
      and a.role <> 'Finance'
      and t.status = 'PENDING_APPROVAL'
      and a.level = (
        select min(a2.level) from approvals a2
        where a2.trip_id = a.trip_id and a2.role <> 'Finance' and a2.decision = 'pending'
      )
  `);
  const avgDays = await scalar(sql`
    select coalesce(avg(extract(epoch from (a.decided_at - t.submitted_at)) / 86400), 0)
    from approvals a
    join trips t on t.id = a.trip_id
    where a.approver_code = ${code} and a.decided_at is not null and t.submitted_at is not null
  `);

  const decisions: DecisionSlice[] = rows(decisionRows).map((r) => ({
    decision: String(r.decision),
    count: num(r.count),
  }));
  const decided = decisions.reduce((s, d) => s + d.count, 0);
  const approved = decisions.find((d) => d.decision === 'approved')?.count ?? 0;

  const kpis: Kpi[] = [
    {
      key: 'pending',
      label: 'Waiting on my decision',
      value: pendingOnMe,
      unit: 'count',
      tone: pendingOnMe > 0 ? 'warn' : 'ok',
    },
    { key: 'decided', label: 'Decisions made', value: decided, unit: 'count' },
    { key: 'approved', label: 'Approved', value: approved, unit: 'count', tone: 'ok' },
    {
      key: 'approvalrate',
      label: 'Approval rate',
      value: decided > 0 ? Math.round((approved / decided) * 100) : 0,
      unit: 'pct',
    },
    {
      key: 'speed',
      label: 'Avg time to decide',
      value: Math.round(avgDays * 10) / 10,
      unit: 'days',
      tone: 'accent',
    },
  ];

  return { ...frame(AnalyticsScope.APPROVER, kpis, status, monthly, categories), decisions };
}

async function financeOverview(): Promise<OverviewPayload> {
  const [status, monthly, categories, reasons] = await Promise.all([
    statusBreakdown(),
    monthlySeries(),
    categoryBreakdown(),
    disallowReasons(),
  ]);

  const totals = rows(
    await db.execute(sql`
      select
        count(*) filter (where t.status = 'PENDING_FINANCE')::int as awaiting_verify,
        count(*) filter (where t.status = 'VERIFIED')::int as awaiting_pay,
        coalesce(sum(s.amount_payable) filter (where t.status = 'PAID'), 0) as paid_value,
        coalesce(sum(s.total_disallowed), 0) as disallowed_total,
        coalesce(sum(s.amount_recoverable), 0) as recoverable_total
      from trips t
      left join settlements s on s.trip_id = t.id
    `),
  )[0] as Row;

  const kpis: Kpi[] = [
    {
      key: 'verify',
      label: 'Awaiting verification',
      value: num(totals.awaiting_verify),
      unit: 'count',
      tone: num(totals.awaiting_verify) > 0 ? 'warn' : 'ok',
    },
    {
      key: 'pay',
      label: 'Verified — awaiting payment',
      value: num(totals.awaiting_pay),
      unit: 'count',
      tone: 'accent',
    },
    { key: 'paid', label: 'Paid out (all time)', value: num(totals.paid_value), unit: 'inr', tone: 'ok' },
    {
      key: 'disallowed',
      label: 'Disallowed (all time)',
      value: num(totals.disallowed_total),
      unit: 'inr',
      tone: 'danger',
    },
    {
      key: 'recoverable',
      label: 'Recoverable from employees',
      value: num(totals.recoverable_total),
      unit: 'inr',
      tone: 'warn',
    },
  ];

  return { ...frame(AnalyticsScope.FINANCE, kpis, status, monthly, categories), disallowReasons: reasons };
}

async function orgOverview(): Promise<OverviewPayload> {
  const [status, monthly, categories, spenders, reasons] = await Promise.all([
    statusBreakdown(),
    monthlySeries(),
    categoryBreakdown(),
    topSpenders(),
    disallowReasons(),
  ]);

  const totals = rows(
    await db.execute(sql`
      select
        count(*)::int as claims,
        coalesce(sum(s.net_reimbursable), 0) as claim_value,
        coalesce(sum(s.amount_payable) filter (where t.status = 'PAID'), 0) as reimbursed,
        coalesce(sum(s.total_disallowed), 0) as disallowed,
        count(*) filter (where t.status not in ('DRAFT', 'PAID', 'REJECTED'))::int as pending,
        coalesce(avg(extract(epoch from (t.updated_at - t.submitted_at)) / 86400)
                 filter (where t.status = 'PAID' and t.submitted_at is not null), 0) as cycle_days
      from trips t
      left join settlements s on s.trip_id = t.id
    `),
  )[0] as Row;

  const kpis: Kpi[] = [
    { key: 'claims', label: 'Total claims', value: num(totals.claims), unit: 'count' },
    { key: 'value', label: 'Total claim value', value: num(totals.claim_value), unit: 'inr' },
    { key: 'reimbursed', label: 'Reimbursed', value: num(totals.reimbursed), unit: 'inr', tone: 'ok' },
    {
      key: 'disallowed',
      label: 'Disallowed by policy',
      value: num(totals.disallowed),
      unit: 'inr',
      tone: 'danger',
    },
    {
      key: 'pending',
      label: 'In the pipeline',
      value: num(totals.pending),
      unit: 'count',
      tone: 'accent',
    },
    {
      key: 'cycle',
      label: 'Avg submit → paid',
      value: Math.round(num(totals.cycle_days) * 10) / 10,
      unit: 'days',
    },
  ];

  return {
    ...frame(AnalyticsScope.ORG, kpis, status, monthly, categories),
    topSpenders: spenders,
    disallowReasons: reasons,
  };
}

async function topSpenders(): Promise<SpenderRow[]> {
  const res = await db.execute(sql`
    select t.employee_code,
           coalesce(e.name, t.employee_code) as name,
           count(*)::int as trips,
           coalesce(sum(s.net_reimbursable), 0) as value
    from trips t
    left join settlements s on s.trip_id = t.id
    left join employees e on e.emp_code = t.employee_code
    group by t.employee_code, e.name
    order by value desc
    limit 6
  `);
  return rows(res).map((r) => ({
    employeeCode: String(r.employee_code),
    name: String(r.name),
    trips: num(r.trips),
    value: num(r.value),
  }));
}

async function disallowReasons(): Promise<ReasonRow[]> {
  const res = await db.execute(sql`
    select coalesce(cl.reason_code, 'OTHER') as reason_code,
           count(*)::int as count,
           coalesce(sum(cl.disallowed_amount), 0) as amount
    from claim_lines cl
    where coalesce(cl.disallowed_amount, 0) > 0
    group by 1
    order by amount desc
    limit 8
  `);
  return rows(res).map((r) => ({
    reasonCode: String(r.reason_code),
    count: num(r.count),
    amount: num(r.amount),
  }));
}

function frame(
  scope: AnalyticsScopeValue,
  kpis: Kpi[],
  statusBreakdownRows: StatusSlice[],
  monthly: MonthPoint[],
  categoryBreakdownRows: CategorySlice[],
): OverviewPayload {
  return {
    scope,
    generatedAt: new Date().toISOString(),
    kpis,
    statusBreakdown: statusBreakdownRows,
    monthly,
    categoryBreakdown: categoryBreakdownRows,
  };
}
