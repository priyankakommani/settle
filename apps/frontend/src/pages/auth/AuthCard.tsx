import type { ReactNode } from 'react';

/** Shared shell for the sign-in / sign-up screens (outside the app shell). */
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
      <div className="auth__card">
        <div className="auth__brand">
          <span className="nav__brand-mark">S</span>
          Settle
        </div>
        <h1 className="auth__title">{title}</h1>
        <p className="auth__subtitle">{subtitle}</p>
        {children}
      </div>
      {footer ? <div className="auth__footer">{footer}</div> : null}
    </div>
  );
}
