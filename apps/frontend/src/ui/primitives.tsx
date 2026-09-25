import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';

/**
 * Low-level presentational primitives. Each one is a thin, typed wrapper over
 * the class names defined in styles/app.css — so screens compose UI without
 * touching CSS classes directly.
 */

const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(' ');

/* ---- Button ---- */
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  block?: boolean;
}
export function Button({
  variant = 'secondary',
  size = 'md',
  block,
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cx(
        'btn',
        variant === 'primary' && 'btn--primary',
        variant === 'ghost' && 'btn--ghost',
        variant === 'danger' && 'btn--danger',
        size === 'sm' && 'btn--sm',
        block && 'btn--block',
        className,
      )}
      {...rest}
    />
  );
}

/* ---- Card ---- */
export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('card', className)} {...rest} />;
}
export function CardHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="card__header">
      <div>
        <div className="card__title">{title}</div>
        {subtitle ? <div className="card__subtitle">{subtitle}</div> : null}
      </div>
      {actions ? <div className="u-row">{actions}</div> : null}
    </div>
  );
}
export function CardBody({
  flush,
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { flush?: boolean }) {
  return <div className={cx('card__body', flush && 'card__body--flush', className)} {...rest} />;
}
export function CardFooter({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('card__footer', className)} {...rest} />;
}

/* ---- Badge ---- */
type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral';
export function Badge({
  tone = 'neutral',
  plain,
  children,
}: {
  tone?: Tone;
  plain?: boolean;
  children: ReactNode;
}) {
  return <span className={cx('badge', `badge--${tone}`, plain && 'badge--plain')}>{children}</span>;
}

/* ---- Stat tile ---- */
export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'accent' | 'ok' | 'danger';
}) {
  return (
    <div className={cx('stat', tone && `stat--${tone}`)}>
      <span className="stat__label">{label}</span>
      <span className="stat__value">{value}</span>
      {hint ? <span className="stat__hint">{hint}</span> : null}
    </div>
  );
}

/* ---- Description list ---- */
export function DescriptionList({ items }: { items: Array<[ReactNode, ReactNode]> }) {
  return (
    <dl className="dl">
      {items.map(([term, val], i) => (
        <div style={{ display: 'contents' }} key={i}>
          <dt>{term}</dt>
          <dd>{val}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ---- Notice ---- */
export function Notice({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'warn' | 'danger';
  children: ReactNode;
}) {
  return <div className={cx('notice', `notice--${tone}`)}>{children}</div>;
}

/* ---- Empty state ---- */
export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      {icon ? <div className="empty__icon">{icon}</div> : null}
      <div className="empty__title">{title}</div>
      {children ? <div>{children}</div> : null}
      {action}
    </div>
  );
}

/* ---- Skeleton ---- */
export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div className="skeleton skeleton--row" key={i} />
      ))}
    </div>
  );
}

export { cx };
