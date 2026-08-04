'use client';

import type { ApiResponse } from '@ayv/types';

/**
 * Same-origin by default: every route this client calls (auth, CRM, clients,
 * projects, tasks, analytics) is a Next.js Route Handler under src/app/api,
 * backed directly by Prisma — there is no separate NestJS host deployed.
 * NEXT_PUBLIC_API_URL remains a documented escape hatch for pointing at a
 * standalone apps/api instance during local development, if you choose to
 * run one instead of the Next.js routes.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api';

const AUTH_URL = '/api/auth';

const ACCESS_TOKEN_KEY = 'ayv.accessToken';
const REFRESH_TOKEN_KEY = 'ayv.refreshToken';
/** Written by auth-context to render the shell without waiting on /auth/me. */
const PROFILE_CACHE_KEY = 'ayv.profile';

export const tokenStore = {
  get access(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(ACCESS_TOKEN_KEY);
  },
  get refresh(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(REFRESH_TOKEN_KEY);
  },
  set(accessToken: string, refreshToken: string): void {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },
  clear(): void {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    // The cached profile is only meaningful alongside a live session. Every
    // path that drops the tokens — logout, a failed refresh, a 401 — must
    // drop it too, or the shell would render against an identity whose
    // session has already ended.
    window.localStorage.removeItem(PROFILE_CACHE_KEY);
  },
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly details?: { field?: string; message: string }[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Set for the refresh call itself, to avoid an infinite retry loop. */
  skipAuthRetry?: boolean;
}

/**
 * A single in-flight refresh shared by every caller.
 *
 * Without this, a dashboard firing six parallel requests on a stale token
 * would trigger six refreshes — and because refresh tokens rotate with reuse
 * detection, five of them would be treated as replay attacks and revoke the
 * session. Coalescing is what makes rotation safe on the client.
 */
let refreshInFlight: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = tokenStore.refresh;
    if (!refreshToken) return false;

    try {
      const response = await fetch(`${AUTH_URL}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      const payload = (await response.json()) as ApiResponse<{
        accessToken: string;
        refreshToken: string;
      }>;

      if (!response.ok || !payload.success) {
        tokenStore.clear();
        return false;
      }

      tokenStore.set(payload.data.accessToken, payload.data.refreshToken);
      return true;
    } catch {
      tokenStore.clear();
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, skipAuthRetry, headers, ...rest } = options;

  const send = async (): Promise<Response> => {
    const token = tokenStore.access;

    return fetch(`${API_URL}${path}`, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  };

  let response = await send();

  if (response.status === 401 && !skipAuthRetry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await send();
    } else if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
      throw new ApiError('Session expired', 'UNAUTHENTICATED', 401);
    }
  }

  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null;

  if (!payload) {
    throw new ApiError('The server returned an unreadable response', 'INTERNAL_ERROR', response.status);
  }

  if (!payload.success) {
    throw new ApiError(
      payload.error.message,
      payload.error.code,
      response.status,
      payload.error.details,
    );
  }

  return payload.data;
}

/** Paginated endpoints return meta alongside data; this preserves both. */
async function requestWithMeta<T>(
  path: string,
  options: RequestOptions = {},
): Promise<{ data: T; meta: Record<string, unknown> }> {
  const { body, headers, ...rest } = options;
  const token = tokenStore.access;

  const response = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const payload = (await response.json()) as ApiResponse<T>;

  if (!payload.success) {
    throw new ApiError(payload.error.message, payload.error.code, response.status);
  }

  return { data: payload.data, meta: (payload.meta ?? {}) as Record<string, unknown> };
}

/** Like `request()`, but targets the same-origin Next.js auth routes. */
async function authRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, skipAuthRetry, headers, ...rest } = options;

  const send = async (): Promise<Response> => {
    const token = tokenStore.access;

    return fetch(`${AUTH_URL}${path}`, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  };

  let response = await send();

  if (response.status === 401 && !skipAuthRetry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await send();
    } else if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
      throw new ApiError('Session expired', 'UNAUTHENTICATED', 401);
    }
  }

  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null;

  if (!payload) {
    throw new ApiError('The server returned an unreadable response', 'INTERNAL_ERROR', response.status);
  }

  if (!payload.success) {
    throw new ApiError(payload.error.message, payload.error.code, response.status, payload.error.details);
  }

  return payload.data;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  getWithMeta: <T>(path: string) => requestWithMeta<T>(path, { method: 'GET' }),

  auth: {
    login: (email: string, password: string) =>
      authRequest<{
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
      }>('/login', { method: 'POST', body: { email, password }, skipAuthRetry: true }),

    logout: async () => {
      const refreshToken = tokenStore.refresh;
      if (refreshToken) {
        await authRequest('/logout', {
          method: 'POST',
          body: { refreshToken },
          skipAuthRetry: true,
        }).catch(() => undefined);
      }
      tokenStore.clear();
    },

    me: () => authRequest<CurrentUser>('/me'),
  },
};

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  organizationId: string;
  clientId: string | null;
  role: { id: string; key: string; level: number };
  permissions: string[];
  permissionScopes: Record<string, 'ALL' | 'TEAM' | 'OWN'>;
}
