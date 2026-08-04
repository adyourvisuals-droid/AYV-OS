import { createHash, randomUUID } from 'node:crypto';

import { hash as hashArgon2, verify as verifyArgon2 } from '@node-rs/argon2';
import { SignJWT, jwtVerify } from 'jose';

import type { Permission } from '@ayv/types';

import { authEnv } from './env';
import { prisma } from './db';

export interface AuthPrincipal {
  userId: string;
  organizationId: string;
  email: string;
  name: string;
  roleId: string;
  roleKey: string;
  roleLevel: number;
  teamId: string | null;
  clientId: string | null;
  permissions: Permission[];
  permissionScopes: Record<string, 'ALL' | 'TEAM' | 'OWN'>;
}

// ─── Passwords ───────────────────────────────────────────────────────────
//
// @node-rs/argon2 (napi-rs prebuilt binaries) rather than the classic
// `argon2` package — it bundles cleanly with Next.js's server build for
// Vercel without native-addon bundling issues. Argon2id is a standardised,
// self-describing hash format (RFC 9106 / PHC string), so hashes produced by
// apps/api's seed script (which uses the classic `argon2` package) verify
// correctly here — same algorithm, same encoding, different library.

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await verifyArgon2(hash, password);
  } catch {
    return false;
  }
}

/** Used only by the one-time /api/admin/bootstrap route to create demo users. */
export async function hashPassword(password: string): Promise<string> {
  return hashArgon2(password);
}

let dummyHashPromise: Promise<string> | null = null;

/**
 * A real, validly-formed Argon2id hash to verify against when no account
 * matches the submitted email — so a login attempt against an unknown
 * address takes the same time as one against a real account with a wrong
 * password, and the response can't be used to enumerate registered emails.
 */
export function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = hashArgon2('constant-time-placeholder-value');
  }
  return dummyHashPromise;
}

// ─── Tokens ──────────────────────────────────────────────────────────────

function accessSecretKey(): Uint8Array {
  return new TextEncoder().encode(authEnv.accessSecret);
}

function refreshSecretKey(): Uint8Array {
  return new TextEncoder().encode(authEnv.refreshSecret);
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function durationToMs(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration.trim());
  if (!match) return 15 * 60 * 1000;
  const value = Number(match[1]);
  const multipliers: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return value * (multipliers[match[2]] ?? 60_000);
}

export interface AccessTokenPayload {
  sub: string;
  org: string;
  role: string;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  family: string;
  type: 'refresh';
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, accessSecretKey());
  if (payload.type !== 'access' || typeof payload.sub !== 'string') {
    throw new Error('Invalid token type');
  }
  return payload as unknown as AccessTokenPayload;
}

export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
  const { payload } = await jwtVerify(token, refreshSecretKey());
  if (payload.type !== 'refresh' || typeof payload.sub !== 'string') {
    throw new Error('Invalid token type');
  }
  return payload as unknown as RefreshTokenPayload;
}

// ─── Sessions ────────────────────────────────────────────────────────────
//
// Mirrors apps/api's AuthService: every refresh rotates the token and
// revokes the one presented. A previously-used token being presented again
// means it was replayed after rotation, so the whole session family is
// revoked — turning stolen-token replay into a detected, contained incident
// rather than a silent compromise.

interface SessionMeta {
  userAgent?: string | null;
  ipAddress?: string | null;
}

export interface IssuedSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export async function issueSession(
  principal: AuthPrincipal,
  meta: SessionMeta,
  familyId: string = randomUUID(),
): Promise<IssuedSession> {
  const accessToken = await new SignJWT({
    org: principal.organizationId,
    role: principal.roleKey,
    type: 'access',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(principal.userId)
    .setIssuedAt()
    .setExpirationTime(authEnv.accessExpiresIn)
    .sign(accessSecretKey());

  const refreshToken = await new SignJWT({ family: familyId, type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(principal.userId)
    .setIssuedAt()
    .setExpirationTime(authEnv.refreshExpiresIn)
    .sign(refreshSecretKey());

  await prisma.session.create({
    data: {
      userId: principal.userId,
      refreshTokenHash: hashToken(refreshToken),
      familyId,
      userAgent: meta.userAgent ?? undefined,
      ipAddress: meta.ipAddress ?? undefined,
      expiresAt: new Date(Date.now() + durationToMs(authEnv.refreshExpiresIn)),
    },
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: Math.round(durationToMs(authEnv.accessExpiresIn) / 1000),
  };
}

export async function revokeSessionFamily(familyId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

// ─── Principal loading ───────────────────────────────────────────────────
//
// Flattens role permissions with per-user overrides into an effective
// permission set — identical logic to apps/api's JwtAuthGuard, so a
// principal computed here has exactly the same shape and semantics as one
// computed by the NestJS API, whenever that comes back online.

/**
 * Short-lived principal cache.
 *
 * Every authenticated request has to resolve its caller's effective
 * permission set, and doing that from scratch costs several round trips to
 * a remote database (user → role → role permissions → permission rows, plus
 * per-user overrides) — well over a second, paid before the route handler
 * even starts. Since a warm serverless instance serves many requests, memoising
 * the result for a few seconds removes that cost from nearly all of them.
 *
 * The TTL is deliberately short because this is authorisation state: a role
 * edit, a permission revocation, or a deactivated account must take effect
 * quickly. PRINCIPAL_CACHE_TTL_MS is the worst-case staleness window, and
 * invalidatePrincipals() clears it immediately on the instance that made a
 * change so the common case is not stale at all.
 */
const PRINCIPAL_CACHE_TTL_MS = 10_000;

const principalCache = new Map<string, { principal: AuthPrincipal; expiresAt: number }>();

/**
 * Drops cached principals so the next request recomputes them. Call after
 * anything that changes what a user is allowed to do.
 *
 * Note this only clears the current instance's cache — other warm instances
 * still expire on their own TTL, so PRINCIPAL_CACHE_TTL_MS remains the real
 * upper bound on how long a permission change can take to apply everywhere.
 */
export function invalidatePrincipals(): void {
  principalCache.clear();
}

export async function loadPrincipal(userId: string): Promise<AuthPrincipal | null> {
  const cached = principalCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.principal;

  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null, status: 'ACTIVE' },
    include: {
      role: { include: { permissions: { include: { permission: true } } } },
      userPermissions: { include: { permission: true } },
    },
  });

  if (!user) {
    // Negative results are not cached: a deactivated or deleted account must
    // stop authenticating immediately, not after the TTL.
    principalCache.delete(userId);
    return null;
  }

  const scopes: Record<string, 'ALL' | 'TEAM' | 'OWN'> = {};
  const granted = new Set<string>();

  for (const grant of user.role.permissions) {
    granted.add(grant.permission.key);
    scopes[grant.permission.key] = grant.scope;
  }

  for (const override of user.userPermissions) {
    if (override.granted) {
      granted.add(override.permission.key);
      scopes[override.permission.key] = override.scope;
    } else {
      granted.delete(override.permission.key);
      delete scopes[override.permission.key];
    }
  }

  const principal: AuthPrincipal = {
    userId: user.id,
    organizationId: user.organizationId,
    email: user.email,
    name: user.name,
    roleId: user.roleId,
    roleKey: user.role.key,
    roleLevel: user.role.level,
    teamId: user.teamId,
    clientId: user.clientId,
    permissions: [...granted] as Permission[],
    permissionScopes: scopes,
  };

  principalCache.set(userId, { principal, expiresAt: Date.now() + PRINCIPAL_CACHE_TTL_MS });

  return principal;
}
