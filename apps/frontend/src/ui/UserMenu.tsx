import { useEffect, useRef, useState } from 'react';
import { EmployeeRole, type EmployeeRoleValue } from '@settle/shared';
import { useSession } from '../app/session.js';
import { useTheme } from '../app/theme.js';
import { Icon } from './icons.js';
import { cx } from './primitives.js';

/** Short badge label per role. */
const ROLE_BADGE: Record<EmployeeRoleValue, string> = {
  [EmployeeRole.EMPLOYEE]: 'EMPLOYEE',
  [EmployeeRole.REPORTING_MANAGER]: 'MANAGER',
  [EmployeeRole.HEAD_OF_DEPARTMENT]: 'HOD',
  [EmployeeRole.HEAD_OF_DIVISION]: 'DIVISION HEAD',
  [EmployeeRole.MD]: 'MD',
  [EmployeeRole.FINANCE]: 'FINANCE',
  [EmployeeRole.ADMIN]: 'ADMIN',
};

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

/** The signed-in user + a popover with account details, theme and sign-out. */
export function UserMenu({ placement = 'down' }: { placement?: 'up' | 'down' }) {
  const { user, signOut } = useSession();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) return null;
  const badge = ROLE_BADGE[user.role] ?? user.role.toUpperCase();

  const pop = (
    <div className={cx('usermenu__pop', `usermenu__pop--${placement}`)} role="menu">
      <div className="usermenu__ident">
        <span className="avatar avatar--lg">{initials(user.name)}</span>
        <div className="usermenu__ident-text">
          <span className="usermenu__name">{user.name}</span>
          <span className="usermenu__meta">
            <span className="rolebadge">{badge}</span>
            <span className="u-subtle">{user.department}</span>
          </span>
          <span className="u-subtle" style={{ fontSize: 'var(--fs-12)' }}>
            {user.email}
          </span>
        </div>
      </div>
      <div className="usermenu__sep" />
      <button className="usermenu__item" type="button" role="menuitem" onClick={toggle}>
        {theme === 'dark' ? <Icon.Sun size={16} /> : <Icon.Moon size={16} />}
        Toggle theme
      </button>
      <button
        className="usermenu__item usermenu__item--danger"
        type="button"
        role="menuitem"
        onClick={() => {
          setOpen(false);
          void signOut();
        }}
      >
        <Icon.Logout size={16} />
        Sign out
      </button>
    </div>
  );

  return (
    <div className={cx('usermenu', `usermenu--${placement}`)} ref={rootRef}>
      {placement === 'up' && open ? pop : null}
      <button
        className="usermenu__trigger"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="avatar">{initials(user.name)}</span>
        <span className="usermenu__trigger-text">
          <span className="usermenu__name u-nowrap">{user.name}</span>
          <span className="usermenu__trigger-role">{badge}</span>
        </span>
        <Icon.ChevronDown size={16} />
      </button>
      {placement === 'down' && open ? pop : null}
    </div>
  );
}
