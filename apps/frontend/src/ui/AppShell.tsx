import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { SideNav } from './SideNav.js';
import { NotificationBell } from './NotificationBell.js';
import { UserMenu } from './UserMenu.js';
import { Icon } from './icons.js';

/**
 * Left: the sidebar (brand + nav) — desktop only. Everywhere: a persistent top
 * bar with the notification bell + account menu on the right, opposite the
 * logo. On narrow screens the sidebar is hidden and reached through a drawer;
 * the brand then lives in the top bar (or the drawer while it's open) — never
 * both at once.
 */
export function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = () => setDrawerOpen(false);

  return (
    <div className="shell">
      <SideNav />

      <div className="shell__main">
        <header className="appbar">
          <button
            className="btn btn--ghost btn--icon appbar__menu"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
            type="button"
          >
            <Icon.Menu />
          </button>
          {!drawerOpen ? (
            <span className="appbar__wordmark">
              <span className="nav__brand-mark">S</span>
              Settle
            </span>
          ) : null}
          <div className="appbar__spacer" />
          <NotificationBell />
          <UserMenu placement="down" />
        </header>

        {drawerOpen ? (
          <>
            <div className="scrim" onClick={closeDrawer} />
            <SideNav drawer onNavigate={closeDrawer} onClose={closeDrawer} />
          </>
        ) : null}

        <main className="shell__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
