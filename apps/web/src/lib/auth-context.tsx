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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      if (!tokenStore.access) {
        setLoading(false);
        return;
      }

      try {
        const me = await api.auth.me();
        if (!cancelled) setUser(me);
      } catch {
        tokenStore.clear();
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
      router.push('/dashboard');
    },
    [router],
  );

  const logout = useCallback(async () => {
    await api.auth.logout();
    setUser(null);
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
