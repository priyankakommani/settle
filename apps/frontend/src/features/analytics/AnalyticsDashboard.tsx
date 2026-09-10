import type { CSSProperties } from 'react';
import type {
  AnalyticsKpi,
  AnalyticsOverview,
  CategorySlice,
  MonthPoint,
  StatusSlice,
} from '../../api/types.js';
import { Card, CardBody, CardHeader, EmptyState } from '../../ui/primitives.js';
import { Money, StatusPill } from '../../ui/domain.js';
import { Icon } from '../../ui/icons.js';

const STATUS_COLORS = ['#5f77ea', '#40b58b', '#e6ae56', '#db6e6e', '#9a83d6', '#6d8ca2', '#8c97a7'];

export function AnalyticsDashboard({ overview }: { overview: AnalyticsOverview }) {
  const secondary = overview.decisions || overview.topSpenders || overview.disallowReasons;

  return (
    <div className="analytics">
      <section className="analytics__kpis" aria-label="Key figures">
        {overview.kpis.map((kpi) => (
          <KpiCard key={kpi.key} kpi={kpi} />
        ))}
      </section>

      {/* Row 1: Claimed vs Approved Smooth Spline Chart (Left) + Spend by Category Horizontal Bar Chart (Right) */}
      <section className="analytics__grid analytics__grid--primary">
        <Card>
          <CardHeader title="Claimed versus approved" subtitle="Last 12 months in your scope" />
          <CardBody>
            <MonthlyChart points={overview.monthly} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Where the money goes" subtitle="By request category — top spend in your scope" />
          <CardBody>
            <CategoryChart rows={overview.categoryBreakdown} />
          </CardBody>
        </Card>
      </section>

      {/* Row 2: Status Breakdown (Left) + Scope Detail (Right) */}
      <section className="analytics__grid analytics__grid--secondary">
        <Card>
          <CardHeader title="Claims by status" />
          <CardBody>
            <StatusChart slices={overview.statusBreakdown} />
          </CardBody>
        </Card>
        {secondary ? <ScopeDetail overview={overview} /> : null}
      </section>
    </div>
  );
}

function KpiCard({ kpi }: { kpi: AnalyticsKpi }) {
  const tone = kpi.tone ?? 'neutral';
  return (
    <div className={`analytics-kpi analytics-kpi--${tone}`}>
      <div className="analytics-kpi__header">
        <span className="analytics-kpi__label">{kpi.label}</span>
        <div className={`analytics-kpi__icon-box analytics-kpi__icon-box--${tone}`}>
          {getKpiIcon(kpi.key)}
        </div>
      </div>
      <div className="analytics-kpi__body">
        <span className="analytics-kpi__value">{formatKpi(kpi)}</span>
        {kpi.hint ? <span className="analytics-kpi__hint">{kpi.hint}</span> : null}
      </div>
      <div className="analytics-kpi__footer">
        <span className={`analytics-kpi__sparkbar analytics-kpi__sparkbar--${tone}`} />
      </div>
    </div>
  );
}

function getKpiIcon(key: string) {
  switch (key) {
    case 'trips':
    case 'claims':
      return <Icon.Briefcase size={18} />;
    case 'in_progress':
    case 'pending':
      return <Icon.Clock size={18} />;
    case 'net':
    case 'value':
      return <Icon.Wallet size={18} />;
    case 'awaiting':
      return <Icon.Alert size={18} />;
    case 'disallowed':
      return <Icon.Ban size={18} />;
    case 'advance':
      return <Icon.Receipt size={18} />;
    case 'decided':
      return <Icon.File size={18} />;
    case 'approved':
      return <Icon.CheckCircle size={18} />;
    case 'approvalrate':
      return <Icon.TrendingUp size={18} />;
    case 'speed':
    case 'cycle':
      return <Icon.Zap size={18} />;
    case 'verify':
      return <Icon.ShieldCheck size={18} />;
    case 'pay':
    case 'paid':
    case 'reimbursed':
      return <Icon.Banknote size={18} />;
    case 'recoverable':
      return <Icon.Refresh size={18} />;
    default:
      return <Icon.Analytics size={18} />;
  }
}

/** Smooth Cubic Bezier Spline Path Generator */
function getSmoothCurvePath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0]!.x} ${pts[0]!.y}`;
  if (pts.length === 2) return `M ${pts[0]!.x} ${pts[0]!.y} L ${pts[1]!.x} ${pts[1]!.y}`;

  let path = `M ${pts[0]!.x.toFixed(1)} ${pts[0]!.y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const curr = pts[i]!;
    const next = pts[i + 1]!;
    const mx = (curr.x + next.x) / 2;
    path += ` C ${mx.toFixed(1)} ${curr.y.toFixed(1)}, ${mx.toFixed(1)} ${next.y.toFixed(1)}, ${next.x.toFixed(1)} ${next.y.toFixed(1)}`;
  }
  return path;
}

function MonthlyChart({ points }: { points: MonthPoint[] }) {
  if (points.length === 0) {
    return <ChartEmpty message="Claim activity will appear here once a claim is created." />;
  }

  const maxVal = Math.max(...points.map((p) => Math.max(p.value, p.paidValue)), 1);
  const width = Math.max(460, points.length * 60);
  const height = 180;
  const paddingLeft = 55;
  const paddingRight = 20;
  const paddingTop = 15;
  const paddingBottom = 35;
  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;
  const baselineY = paddingTop + plotHeight;
  const slot = plotWidth / Math.max(points.length - 1, 1);

  const totalClaimed = points.reduce((s, p) => s + p.value, 0);
  const totalPaid = points.reduce((s, p) => s + p.paidValue, 0);

  const claimPts = points.map((p, i) => {
    const x = paddingLeft + (points.length === 1 ? plotWidth / 2 : i * slot);
    const y = baselineY - Math.max(p.value > 0 ? 3 : 0, (p.value / maxVal) * plotHeight);
    return { x, y };
  });

  const paidPts = points.map((p, i) => {
    const x = paddingLeft + (points.length === 1 ? plotWidth / 2 : i * slot);
    const y = baselineY - Math.max(p.paidValue > 0 ? 3 : 0, (p.paidValue / maxVal) * plotHeight);
    return { x, y };
  });

  const claimCurveD = getSmoothCurvePath(claimPts);
  const claimAreaD = claimCurveD
    ? `${claimCurveD} L ${claimPts[claimPts.length - 1]!.x} ${baselineY} L ${claimPts[0]!.x} ${baselineY} Z`
    : '';

  const paidCurveD = getSmoothCurvePath(paidPts);
  const paidAreaD = paidCurveD
    ? `${paidCurveD} L ${paidPts[paidPts.length - 1]!.x} ${baselineY} L ${paidPts[0]!.x} ${baselineY} Z`
    : '';

  const yTicks = [0, 0.33, 0.66, 1];
  const lastPoint = points[points.length - 1];

  return (
    <div className="analytics-chart analytics-chart--monthly">
      <div className="analytics-chart__legend">
        <Legend color="#3b82f6" label={`Claimed (${moneyText(totalClaimed)})`} />
        <Legend color="#f97316" label={`Approved (${moneyText(totalPaid)})`} />
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Monthly claimed versus approved smooth curve chart">
        <defs>
          <linearGradient id="smoothClaimGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
          </linearGradient>
          <linearGradient id="smoothPaidGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Horizontal Gridlines & Y-axis Scale Ticks */}
        {yTicks.map((tick) => {
          const y = paddingTop + plotHeight * (1 - tick);
          const val = Math.round(maxVal * tick);
          return (
            <g key={tick}>
              <line x1={paddingLeft} x2={width - paddingRight} y1={y} y2={y} className="analytics-chart__gridline" />
              <text x={paddingLeft - 8} y={y + 3} className="analytics-chart__tick-label" textAnchor="end">
                {formatCompactMoney(val)}
              </text>
            </g>
          );
        })}

        {/* Y-axis left border */}
        <line x1={paddingLeft} x2={paddingLeft} y1={paddingTop} y2={baselineY} className="analytics-chart__axis" />
        {/* X-axis baseline */}
        <line x1={paddingLeft} x2={width - paddingRight} y1={baselineY} y2={baselineY} className="analytics-chart__axis" />

        {/* Smooth Gradient Area Fills */}
        {claimAreaD ? <path d={claimAreaD} fill="url(#smoothClaimGrad)" /> : null}
        {paidAreaD ? <path d={paidAreaD} fill="url(#smoothPaidGrad)" /> : null}

        {/* Smooth Spline Curves */}
        {claimCurveD ? <path d={claimCurveD} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" /> : null}
        {paidCurveD ? <path d={paidCurveD} fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" /> : null}

        {/* Data points & X-axis Month Labels */}
        {points.map((point, index) => {
          const cp = claimPts[index]!;
          const pp = paidPts[index]!;
          return (
            <g key={point.month}>
              <title>{`${monthLabel(point.month)}: ${moneyText(point.value)} claimed, ${moneyText(point.paidValue)} paid`}</title>
              {point.value > 0 && <circle cx={cp.x} cy={cp.y} r="3.5" fill="#3b82f6" stroke="var(--surface)" strokeWidth="1.5" />}
              {point.paidValue > 0 && <circle cx={pp.x} cy={pp.y} r="3.5" fill="#f97316" stroke="var(--surface)" strokeWidth="1.5" />}
              <text className="analytics-chart__label" x={cp.x} y={baselineY + 18} textAnchor="middle">
                {shortMonth(point.month)}
              </text>
            </g>
          );
        })}
      </svg>

      {lastPoint ? (
        <div className="analytics-chart__footer-note">
          This month: <strong>{moneyText(lastPoint.value)}</strong> claimed · months still deciding show a lower approved line
        </div>
      ) : null}
    </div>
  );
}

function CategoryChart({ rows }: { rows: CategorySlice[] }) {
  if (rows.length === 0) {
    return <ChartEmpty message="Category spend will appear after claim lines are assessed." />;
  }

  // Sort descending by total spend (allowed + disallowed)
  const sorted = [...rows].sort((a, b) => (b.allowed + b.disallowed) - (a.allowed + a.disallowed));
  const maxVal = Math.max(...sorted.map((r) => r.allowed + r.disallowed), 1);
  const largest = sorted[0];

  const width = 480;
  const height = Math.max(160, sorted.length * 32 + 45);
  const paddingLeft = 125;
  const paddingRight = 45;
  const paddingTop = 15;
  const paddingBottom = 35;
  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;
  const rowHeight = plotHeight / sorted.length;

  const xTicks = [0, 0.5, 1];

  return (
    <div className="analytics-chart category-chart">
      <div className="analytics-chart__legend">
        <Legend color="#3b82f6" label="Allowed" />
        {sorted.some((r) => r.disallowed > 0) && <Legend color="#ef4444" label="Disallowed" />}
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Spend by category horizontal bar graph">
        <defs>
          <linearGradient id="horizAllowedGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="1" />
          </linearGradient>
          <linearGradient id="horizDisallowedGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#dc2626" stopOpacity="1" />
          </linearGradient>
        </defs>

        {/* Vertical Grid Lines & X-axis Currency Scale */}
        {xTicks.map((tick) => {
          const x = paddingLeft + plotWidth * tick;
          const val = Math.round(maxVal * tick);
          return (
            <g key={tick}>
              <line x1={x} x2={x} y1={paddingTop} y2={paddingTop + plotHeight} className="analytics-chart__gridline" />
              <text x={x} y={paddingTop + plotHeight + 18} className="analytics-chart__tick-label" textAnchor="middle">
                {formatCompactMoney(val)}
              </text>
            </g>
          );
        })}

        {/* Y-axis left line */}
        <line
          x1={paddingLeft}
          x2={paddingLeft}
          y1={paddingTop}
          y2={paddingTop + plotHeight}
          className="analytics-chart__axis"
        />

        {/* Horizontal Bars */}
        {sorted.map((row, i) => {
          const yCenter = paddingTop + i * rowHeight + rowHeight / 2;
          const barH = Math.min(16, rowHeight * 0.55);
          const barY = yCenter - barH / 2;
          const total = row.allowed + row.disallowed;

          const allowedW = (row.allowed / maxVal) * plotWidth;
          const disallowedW = (row.disallowed / maxVal) * plotWidth;

          return (
            <g key={row.category} className="category-chart__row">
              <title>{`${humanize(row.category)}: ${moneyText(row.allowed)} allowed, ${moneyText(row.disallowed)} disallowed`}</title>

              {/* Category Name on Left (Y-axis) */}
              <text
                x={paddingLeft - 10}
                y={yCenter + 4}
                className="analytics-chart__label u-fw-500"
                textAnchor="end"
              >
                {humanize(row.category)}
              </text>

              {/* Allowed Horizontal Bar */}
              {row.allowed > 0 && (
                <rect
                  x={paddingLeft}
                  y={barY}
                  width={Math.max(4, allowedW)}
                  height={barH}
                  rx={4}
                  fill="url(#horizAllowedGrad)"
                  className="analytics-chart__bar"
                />
              )}

              {/* Disallowed Horizontal Bar */}
              {row.disallowed > 0 && (
                <rect
                  x={paddingLeft + allowedW}
                  y={barY}
                  width={Math.max(4, disallowedW)}
                  height={barH}
                  rx={4}
                  fill="url(#horizDisallowedGrad)"
                  className="analytics-chart__bar"
                />
              )}

              {/* Value Label on End of Bar */}
              <text
                x={paddingLeft + allowedW + disallowedW + 8}
                y={yCenter + 4}
                className="analytics-chart__value-label"
                textAnchor="start"
              >
                {formatCompactMoney(total)}
              </text>
            </g>
          );
        })}
      </svg>

      {largest ? (
        <div className="analytics-chart__footer-note">
          Largest: <strong>{humanize(largest.category)}</strong> at <span>{moneyText(largest.allowed + largest.disallowed)}</span>
        </div>
      ) : null}
    </div>
  );
}

function StatusChart({ slices }: { slices: StatusSlice[] }) {
  if (slices.length === 0) {
    return <ChartEmpty message="Claim statuses will appear here once there is activity." />;
  }

  const totalCount = slices.reduce((sum, slice) => sum + slice.count, 0);

  let cursor = 0;
  const stops = slices.map((slice, i) => {
    const start = (cursor / totalCount) * 100;
    cursor += slice.count;
    const end = (cursor / totalCount) * 100;
    return `${STATUS_COLORS[i % STATUS_COLORS.length]} ${start}% ${end}%`;
  });
  const style = { background: `conic-gradient(${stops.join(', ')})` } as CSSProperties;

  return (
    <div className="status-overview">
      {/* Top compact proportion bar */}
      <div className="status-overview__bar-container" title={`${totalCount} total claims`}>
        <div className="status-overview__bar">
          {slices.map((slice, i) => {
            const pct = Math.max(1, (slice.count / totalCount) * 100);
            return (
              <span
                key={slice.status}
                style={{
                  width: `${pct}%`,
                  backgroundColor: STATUS_COLORS[i % STATUS_COLORS.length],
                }}
              />
            );
          })}
        </div>
      </div>

      <div className="status-overview__content">
        {/* Compact Center Donut */}
        <div className="status-chart__donut" style={style} aria-label={`${totalCount} claims across statuses`}>
          <div className="status-chart__middle">
            <strong>{totalCount}</strong>
            <span>claims</span>
          </div>
        </div>

        {/* High-Density Status Cards Grid */}
        <div className="status-overview__cards">
          {slices.map((slice, i) => {
            const pct = Math.round((slice.count / totalCount) * 100);
            const color = STATUS_COLORS[i % STATUS_COLORS.length];
            return (
              <div
                key={slice.status}
                className="status-card"
                style={{ borderLeftColor: color }}
              >
                <div className="status-card__top">
                  <StatusPill status={slice.status} />
                  <span className="status-card__pct">{pct}%</span>
                </div>
                <div className="status-card__bottom">
                  <div className="status-card__count">
                    <strong>{slice.count}</strong>
                    <span>{slice.count === 1 ? 'claim' : 'claims'}</span>
                  </div>
                  {slice.value > 0 && (
                    <span className="status-card__value" title={moneyText(slice.value)}>
                      {formatCompactMoney(slice.value)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ScopeDetail({ overview }: { overview: AnalyticsOverview }) {
  if (overview.topSpenders) {
    return (
      <Card>
        <CardHeader title="Highest claim value" />
        <CardBody flush>
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Trips</th>
                <th className="table__num">Value</th>
              </tr>
            </thead>
            <tbody>
              {overview.topSpenders.map((row) => (
                <tr key={row.employeeCode}>
                  <td>
                    <strong>{row.name}</strong>
                    <br />
                    <span className="u-subtle u-mono">{row.employeeCode}</span>
                  </td>
                  <td>{row.trips}</td>
                  <td className="table__num">
                    <Money value={row.value} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    );
  }

  if (overview.decisions) {
    const total = overview.decisions.reduce((sum, row) => sum + row.count, 0);
    return (
      <Card>
        <CardHeader title="My decisions" />
        <CardBody>
          <div className="decision-list">
            {overview.decisions.length ? (
              overview.decisions.map((row) => (
                <div key={row.decision}>
                  <span>{humanize(row.decision)}</span>
                  <strong>{row.count}</strong>
                </div>
              ))
            ) : (
              <p className="u-muted">No decisions recorded yet.</p>
            )}
            {overview.decisions.length ? (
              <div className="decision-list__total">
                <span>Total decided</span>
                <strong>{total}</strong>
              </div>
            ) : null}
          </div>
        </CardBody>
      </Card>
    );
  }

  if (overview.disallowReasons && overview.disallowReasons.length > 0) {
    return (
      <Card>
        <CardHeader title="Policy exceptions by value" />
        <CardBody>
          <div className="reason-list">
            {overview.disallowReasons.map((row) => (
              <div key={row.reasonCode}>
                <span>{humanize(row.reasonCode)}</span>
                <span>
                  {row.count} line{row.count === 1 ? '' : 's'} · <Money value={row.amount} />
                </span>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Policy Rules & Limits" />
      <CardBody>
        <div className="policy-guide">
          <div className="policy-guide__item">
            <span className="policy-guide__label">Lodging Cap (Tier 1)</span>
            <strong className="policy-guide__val">₹10,000 / day</strong>
          </div>
          <div className="policy-guide__item">
            <span className="policy-guide__label">Daily Meal Allowance</span>
            <strong className="policy-guide__val">₹2,500 / day</strong>
          </div>
          <div className="policy-guide__item">
            <span className="policy-guide__label">Receipt Requirement</span>
            <strong className="policy-guide__val">Mandatory for items &gt; ₹500</strong>
          </div>
          <div className="policy-guide__item">
            <span className="policy-guide__label">Travel Advance Limit</span>
            <strong className="policy-guide__val">Up to 60% of estimated cost</strong>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function ChartEmpty({ message }: { message: string }) {
  return (
    <EmptyState icon={<Icon.Analytics size={20} />} title="No data yet">
      {message}
    </EmptyState>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span>
      <i className="analytics-chart__legend-dot" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function formatKpi(kpi: AnalyticsKpi): string {
  if (kpi.unit === 'inr') return moneyText(kpi.value);
  if (kpi.unit === 'pct') return `${kpi.value}%`;
  if (kpi.unit === 'days') return `${kpi.value} ${kpi.value === 1 ? 'day' : 'days'}`;
  return new Intl.NumberFormat('en-IN').format(kpi.value);
}

function moneyText(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompactMoney(value: number): string {
  if (value >= 100000) return `₹${(value / 100000).toFixed(2)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}k`;
  return `₹${Math.round(value)}`;
}

function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleString('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function shortMonth(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleString('en-IN', {
    month: 'short',
    timeZone: 'UTC',
  });
}

function humanize(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
