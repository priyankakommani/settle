import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '../ui/AppShell.js';
import { RequireArea, RequireAuth } from './guards.js';
import { useSession } from './session.js';
import { homePathFor } from './roles.js';
import { SignInPage } from '../pages/SignInPage.js';
import { SignUpPage } from '../pages/SignUpPage.js';
import { TripsListPage } from '../pages/TripsListPage.js';
import { NewTripPage } from '../pages/NewTripPage.js';
import { TripWorkspacePage } from '../pages/TripWorkspacePage.js';
import { QueuePage } from '../pages/QueuePage.js';
import { ReviewPage } from '../pages/ReviewPage.js';
import { NotFoundPage } from '../pages/NotFoundPage.js';
import { AnalyticsPage } from '../pages/AnalyticsPage.js';
import { AdminClaimsPage } from '../pages/AdminClaimsPage.js';
import { AdminClaimDetailPage } from '../pages/AdminClaimDetailPage.js';

/** Sends "/" to the current role's home screen. */
function HomeRedirect() {
  const { user } = useSession();
  return <Navigate to={user ? homePathFor(user.role) : '/signin'} replace />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/signin" element={<SignInPage />} />
      <Route path="/signup" element={<SignUpPage />} />

      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<HomeRedirect />} />

        <Route
          path="analytics"
          element={
            <RequireArea area="analytics">
              <AnalyticsPage />
            </RequireArea>
          }
        />

        <Route
          path="trips"
          element={
            <RequireArea area="trips">
              <TripsListPage />
            </RequireArea>
          }
        />
        <Route
          path="trips/new"
          element={
            <RequireArea area="trips">
              <NewTripPage />
            </RequireArea>
          }
        />
        <Route
          path="trips/:id"
          element={
            <RequireArea area="trips">
              <TripWorkspacePage />
            </RequireArea>
          }
        />

        <Route
          path="approvals"
          element={
            <RequireArea area="approvals">
              <QueuePage area="approvals" />
            </RequireArea>
          }
        />
        <Route
          path="approvals/:id"
          element={
            <RequireArea area="approvals">
              <ReviewPage area="approvals" />
            </RequireArea>
          }
        />

        <Route
          path="finance"
          element={
            <RequireArea area="finance">
              <QueuePage area="finance" />
            </RequireArea>
          }
        />
        <Route
          path="finance/:id"
          element={
            <RequireArea area="finance">
              <ReviewPage area="finance" />
            </RequireArea>
          }
        />

        <Route
          path="admin/claims"
          element={
            <RequireArea area="admin">
              <AdminClaimsPage />
            </RequireArea>
          }
        />
        <Route
          path="admin/claims/:id"
          element={
            <RequireArea area="admin">
              <AdminClaimDetailPage />
            </RequireArea>
          }
        />

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
