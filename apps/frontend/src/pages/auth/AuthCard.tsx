import type { ReactNode } from 'react';

/**
 * Shell for the sign-in / sign-up screens (outside the app shell).
 * Split layout: a brand panel that explains what Settle does, and the form.
 */

const FLOW = [
  {
    n: 1,
    title: 'Ingest the trip',
    text: 'Approval mail, e-tickets, hotel folio, cab and meal receipts — text or photos.',
  },
  {
    n: 2,
    title: 'Check the policy',
    text: 'Lodging and meal caps, non-reimbursable items, and the approval matrix by claim value.',
  },
  {
    n: 3,
    title: 'Route for approval',
    text: 'The right chain for the amount. Approvers can approve, reject, or return with remarks.',
  },
  {
    n: 4,
    title: 'Settle and pay',
    text: 'Finance verifies, the advance is adjusted, and payment goes out on the 10th and 25th.',
  },
];

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="auth">
      <aside className="auth__aside">
        <div className="auth__aside-inner">
          <div className="auth__brand auth__brand--light">
            <span className="nav__brand-mark">S</span>
            Settle
          </div>

          <h2 className="auth__pitch">From a trip&rsquo;s inbox to a settled claim.</h2>
          <p className="auth__pitch-sub">
            Settle reads a business trip&rsquo;s emails and receipts, builds the expense
            settlement, checks it against the Nortex travel &amp; expense policy, and moves it
            through approval to payment &mdash; no manual form, no chasing Finance.
          </p>

          <ol className="auth__flow">
            {FLOW.map((s) => (
              <li key={s.n} className="auth__flow-step">
                <span className="auth__flow-num">{s.n}</span>
                <span className="auth__flow-text">
                  <strong>{s.title}</strong>
                  <span>{s.text}</span>
                </span>
              </li>
            ))}
          </ol>

          <p className="auth__aside-foot">Nortex Industries Ltd &middot; Travel &amp; Expense</p>
        </div>
      </aside>

      <main className="auth__main">
        <div className="auth__card">
          <div className="auth__brand auth__brand--compact">
            <span className="nav__brand-mark">S</span>
            Settle
          </div>
          <h1 className="auth__title">{title}</h1>
          <p className="auth__subtitle">{subtitle}</p>
          {children}
          {footer ? <div className="auth__footer">{footer}</div> : null}
        </div>
      </main>
    </div>
  );
}
