import { NavLink } from 'react-router-dom';
import { useSession } from '../app/session.js';
import { navItemsFor, type NavArea } from '../app/roles.js';
import { Icon } from './icons.js';
import { cx } from './primitives.js';

const AREA_ICON: Record<NavArea, (p: { size?: number }) => JSX.Element> = {
  analytics: Icon.Analytics,
  trips: Icon.Trips,
  approvals: Icon.Approvals,
  finance: Icon.Wallet,
  admin: Icon.Admin,
};

export function SideNav({
  drawer,
  onNavigate,
  onClose,
}: {
  drawer?: boolean;
  onNavigate?: () => void;
  onClose?: () => void;
}) {
  const { user } = useSession();
  if (!user) return null;

  const items = navItemsFor(user.role);

  return (
    <aside className={cx('nav', drawer && 'nav--drawer')}>
      <div className="nav__brand">
        <span className="nav__brand-mark">S</span>
        <span className="u-grow">Settle</span>
        {drawer && onClose ? (
          <button
            className="btn btn--ghost btn--icon btn--sm"
            onClick={onClose}
            aria-label="Close navigation"
            type="button"
          >
            <Icon.Close size={16} />
          </button>
        ) : null}
      </div>

      <div className="nav__section-label">Workspace</div>
      {items.map((item) => {
        const IconEl = AREA_ICON[item.area];
        return (
          <NavLink
            key={item.area}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) => cx('nav__link', isActive && 'is-active')}
          >
            <IconEl size={18} />
            {item.label}
          </NavLink>
        );
      })}
    </aside>
  );
}
