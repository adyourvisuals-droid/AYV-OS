'use client';

import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { api, tokenStore, type CurrentUser } from './api';

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** True when the principal holds every listed permission. */
  can: (...permissions: string[]) => boolean;
  /** True when the principal holds at least one of the listed permissions. */
  canAny: (...permissions: string[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const PROFILE_CACHE_KEY = 'ayv.profile';

/**
 * The last known profile, read synchronously during the first render.
 *
 * The shell renders a full-screen spinner while `user` is null, and every
 * page defers its own data fetch until permissions are known. Waiting for
 * /api/auth/me before either could happen made the critical path three
 * sequential trips — document, then the profile, then the page's data — with
 * nothing on screen for the first two.
 *
 * Seeding from cache collapses that: the shell and the page's fetch start in
 * the same tick as revalidation, not after it. This is a *rendering* hint
 * only. Tampering with it changes which nav items a user sees, never what
 * they can do — permissions are re-checked server-side on every request, and
 * a request whose token doesn't carry the permission is refused regardless of
 * what this cache claims.
 */
function readCachedProfile(): CurrentUser | null {
  if (typeof window === 'undefined') return null;
  if (!window.localStorage.getItem('ayv.accessToken')) return null;

  try {
    const raw = window.localStorage.getItem(PROFILE_CACHE_KEY);
    return raw ? (JSON.parse(raw) as CurrentUser) : null;
  } catch {
    return null;
  }
}

function writeCachedProfile(user: CurrentUser | null): void {
  if (typeof window === 'undefined') return;
  if (user) {
    window.localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(user));
  } else {
    window.localStorage.removeItem(PROFILE_CACHE_KEY);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Lazy initialisers: run during the first render, before paint, so a
  // returning user never sees the spinner at all. Both derive from a single
  // read so they cannot disagree about whether a cached profile was found.
  const [cachedProfile] = useState(readCachedProfile);
  const [user, setUser] = useState<CurrentUser | null>(cachedProfile);
  const [loading, setLoading] = useState(cachedProfile === null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      if (!tokenStore.access) {
        writeCachedProfile(null);
        setLoading(false);
        return;
      }

      // Always revalidate, even when the cache supplied a user — a role or
      // permission changed server-side must land without a re-login. The
      // difference is that this now happens *behind* a rendered UI rather
      // than in front of a spinner.
      try {
        const me = await api.auth.me();
        if (cancelled) return;
        setUser(me);
        writeCachedProfile(me);
      } catch {
        if (cancelled) return;
        // The cached profile outlived its session; drop it so the shell
        // redirects to /login rather than rendering against stale identity.
        tokenStore.clear();
        writeCachedProfile(null);
        setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await api.auth.login(email, password);
      tokenStore.set(result.accessToken, result.refreshToken);
      const me = await api.auth.me();
      setUser(me);
      writeCachedProfile(me);
      router.push('/dashboard');
    },
    [router],
  );

  const logout = useCallback(async () => {
    await api.auth.logout();
    setUser(null);
    writeCachedProfile(null);
    router.push('/login');
  }, [router]);

  const value = useMemo<AuthContextValue>(() => {
    const held = new Set(user?.permissions ?? []);
    return {
      user,
      loading,
      login,
      logout,
      can: (...permissions: string[]) => permissions.every((permission) => held.has(permission)),
      canAny: (...permissions: string[]) => permissions.some((permission) => held.has(permission)),
    };
  }, [user, loading, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
