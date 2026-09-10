import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './icons.js';

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-header__titles">
        {eyebrow ? <span className="page-header__eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {subtitle ? <span className="page-header__subtitle">{subtitle}</span> : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  );
}

export function Breadcrumb({ trail }: { trail: Array<{ label: string; to?: string }> }) {
  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      {trail.map((item, i) => (
        <span className="u-row" key={i}>
          {item.to ? <Link to={item.to}>{item.label}</Link> : <span>{item.label}</span>}
          {i < trail.length - 1 ? <Icon.ChevronRight size={14} /> : null}
        </span>
      ))}
    </nav>
  );
}
