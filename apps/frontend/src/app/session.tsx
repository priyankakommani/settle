import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi, type Credentials } from '../api/endpoints.js';
import { ApiError } from '../api/client.js';
import type { Me } from '../api/types.js';

/**
 * Session = the signed-in user. The token lives in an httpOnly cookie the JS
 * never sees; on mount we ask the server who we are via GET /auth/me.
 * Everything role-aware (nav, guards, home path) reads from here.
 */
interface SessionState {
  status: 'loading' | 'signed-out' | 'signed-in';
  user: Me | null;
  /** only set for real failures (network / server), not for "not signed in" */
  error: string | null;
}

interface SessionApi extends SessionState {
  signIn: (creds: Credentials) => Promise<Me>;
  signUp: (creds: Credentials) => Promise<Me>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const SessionCtx = createContext<SessionApi | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<SessionState>({
    status: 'loading',
    user: null,
    error: null,
  });

  /**
   * Wipe every cached query so a different user never sees the previous user's
   * trips / queues / notifications until a manual refresh.
   */
  const wipeCache = useCallback(() => {
    queryClient.cancelQueries();
    queryClient.clear();
  }, [queryClient]);

  const refresh = useCallback(async () => {
    try {
      const user = await authApi.me();
      setState({ status: 'signed-in', user, error: null });
    } catch (err) {
      if (err instanceof ApiError && err.isAuthError) {
        setState({ status: 'signed-out', user: null, error: null });
      } else {
        setState({
          status: 'signed-out',
          user: null,
          error:
            err instanceof ApiError
              ? `Could not reach the server (${err.code}).`
              : 'Could not reach the server.',
        });
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signIn = useCallback(
    async (creds: Credentials) => {
      const { user } = await authApi.login(creds);
      wipeCache();
      setState({ status: 'signed-in', user, error: null });
      return user;
    },
    [wipeCache],
  );

  const signUp = useCallback(
    async (creds: Credentials) => {
      const { user } = await authApi.signup(creds);
      wipeCache();
      setState({ status: 'signed-in', user, error: null });
      return user;
    },
    [wipeCache],
  );

  const signOut = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      wipeCache();
      setState({ status: 'signed-out', user: null, error: null });
    }
  }, [wipeCache]);

  const api = useMemo<SessionApi>(
    () => ({ ...state, signIn, signUp, signOut, refresh }),
    [state, signIn, signUp, signOut, refresh],
  );

  return <SessionCtx.Provider value={api}>{children}</SessionCtx.Provider>;
}

export function useSession(): SessionApi {
  const ctx = useContext(SessionCtx);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}

/** Convenience for screens that are always rendered behind the auth guard. */
export function useCurrentUser(): Me {
  const { user } = useSession();
  if (!user) throw new Error('useCurrentUser called before sign-in');
  return user;
}
