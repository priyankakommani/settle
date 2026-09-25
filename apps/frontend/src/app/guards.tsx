import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useSession } from './session.js';
import { allowedAreasFor, homePathFor, type NavArea } from './roles.js';
import { SkeletonRows } from '../ui/primitives.js';

/**
 * Gate for every in-app route. While the session resolves we show a calm
 * placeholder; if there's no session we bounce to /signin.
 *
 * We deliberately do NOT remember the attempted URL: the next sign-in may be a
 * different user (people switch roles here constantly) and sending them to the
 * previous user's deep link produces 403/404s on a resource they can't see.
 * Everyone lands on their own role home after signing in.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useSession();

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
    return <Navigate to="/signin" replace />;
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
