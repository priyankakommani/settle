import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSession } from './session.js';
import { allowedAreasFor, homePathFor, type NavArea } from './roles.js';
import { SkeletonRows } from '../ui/primitives.js';

/**
 * Gate for every in-app route. While the session resolves we show a calm
 * placeholder; if there's no session we bounce to /signin (remembering where
 * the user was headed).
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="app-loading">
        <div className="app-loading__inner">
          <SkeletonRows rows={3} />
        </div>
      </div>
    );
  }
  if (status === 'signed-out') {
    return <Navigate to="/signin" replace state={{ from: location.pathname + location.search }} />;
  }
  return <>{children}</>;
}

/**
 * Area-level authorisation. If the current role can't reach this area, send
 * the user to their own home rather than showing a dead end.
 */
export function RequireArea({ area, children }: { area: NavArea; children: ReactNode }) {
  const { user } = useSession();
  if (!user) return <Navigate to="/signin" replace />;
  if (!allowedAreasFor(user.role).includes(area)) {
    return <Navigate to={homePathFor(user.role)} replace />;
  }
  return <>{children}</>;
}
