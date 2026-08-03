import { randomUUID } from 'node:crypto';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import type { Permission } from '@ayv/types';

import { loadPrincipal, verifyAccessToken, type AuthPrincipal } from './auth';
import { errorResponse } from './http';
import { RequestContextStore } from './request-context';

/**
 * Authenticates the bearer token on a request.
 *
 * Mirrors apps/api's JwtAuthGuard: resolves the token to a full principal
 * (permissions flattened, scopes attached) rather than just a user id, so
 * every route handler gets the same shape NestJS controllers used to.
 */
export async function authenticate(req: NextRequest): Promise<AuthPrincipal | NextResponse> {
  const header = req.headers.get('authorization');
  const token = header?.toLowerCase().startsWith('bearer ') ? header.slice(7) : null;

  if (!token) {
    return errorResponse(401, 'UNAUTHENTICATED', 'Authentication required');
  }

  let payload;
  try {
    payload = await verifyAccessToken(token);
  } catch {
    return errorResponse(401, 'TOKEN_EXPIRED', 'Invalid or expired token');
  }

  const principal = await loadPrincipal(payload.sub);
  if (!principal) {
    return errorResponse(401, 'UNAUTHENTICATED', 'Account is no longer active');
  }

  return principal;
}

/** Mirrors apps/api's PermissionsGuard: every listed permission must be held. */
export function requirePermission(
  principal: AuthPrincipal,
  ...permissions: Permission[]
): NextResponse | null {
  const held = new Set(principal.permissions);
  const missing = permissions.filter((permission) => !held.has(permission));

  if (missing.length > 0) {
    return errorResponse(
      403,
      'INSUFFICIENT_PERMISSION',
      `Missing required permission: ${missing.join(', ')}`,
    );
  }

  return null;
}

/**
 * Authenticates, checks the required permissions, and runs the handler
 * inside a request context — so every Prisma query the handler makes is
 * automatically tenant-scoped to the caller's organization (see
 * prisma-extensions.ts). This is the Next.js equivalent of apps/api's
 * JwtAuthGuard + PermissionsGuard + tenant-scoping middleware stack, all in
 * one call.
 */
export async function withAuth(
  req: NextRequest,
  permissions: Permission[],
  handler: (principal: AuthPrincipal) => Promise<NextResponse>,
): Promise<NextResponse> {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;
  const principal = auth;

  const denied = requirePermission(principal, ...permissions);
  if (denied) return denied;

  return RequestContextStore.run(
    {
      requestId: randomUUID(),
      organizationId: principal.organizationId,
      userId: principal.userId,
      clientId: principal.clientId ?? undefined,
      roleKey: principal.roleKey,
      permissions: principal.permissions,
    },
    async () => {
      try {
        return await handler(principal);
      } catch (error) {
        return errorResponse(
          500,
          'INTERNAL_ERROR',
          error instanceof Error ? error.message : 'Request failed unexpectedly',
        );
      }
    },
  );
}
