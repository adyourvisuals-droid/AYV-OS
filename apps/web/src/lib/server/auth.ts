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
//
// This runs on *every* authenticated request, so its cost is a floor under
// the whole API. Expressed as a Prisma `include` tree it cost five sequential
// round trips (User → Role → RolePermission → Permission → UserPermission),
// because Prisma resolves each relation level as its own query. Against a
// database in the same datacentre that is invisible; against a managed
// Postgres one region away it was ~5×RTT of pure overhead before a route did
// any of its own work. The lateral-join form below answers the same question
// in one round trip, and the cache in front of it usually answers in none.

interface PrincipalRow {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  roleId: string;
  teamId: string | null;
  clientId: string | null;
  roleKey: string;
  roleLevel: number;
  rolePermissions: { key: string; scope: 'ALL' | 'TEAM' | 'OWN' }[] | null;
  userPermissions: { key: string; scope: 'ALL' | 'TEAM' | 'OWN'; granted: boolean }[] | null;
}

/**
 * Effective permissions change only when an admin edits a role or a user —
 * rare, and never in the middle of the request that reads them. Caching the
 * flattened principal for a few seconds turns the common case (a page firing
 * several API calls at once, a user clicking through screens) into zero
 * authentication queries, while keeping the window in which a revoked
 * permission is still honoured short enough to be operationally harmless.
 *
 * Writes that change permissions call `invalidatePrincipal` so the change is
 * immediate for the affected user rather than TTL-delayed.
 */
const PRINCIPAL_TTL_MS = 15_000;
const PRINCIPAL_CACHE_MAX = 500;

const principalCache = new Map<string, { principal: AuthPrincipal; expiresAt: number }>();

/** Drops a user's cached principal — call after any role/permission change. */
export function invalidatePrincipal(userId: string): void {
  principalCache.delete(userId);
}

/** Drops every cached principal — call after a role's permissions change. */
export function invalidateAllPrincipals(): void {
  principalCache.clear();
}

export async function loadPrincipal(userId: string): Promise<AuthPrincipal | null> {
  const cached = principalCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.principal;

  const rows = await prisma.$queryRaw<PrincipalRow[]>`
    SELECT
      u."id",
      u."organizationId",
      u."email",
      u."name",
      u."roleId",
      u."teamId",
      u."clientId",
      r."key"   AS "roleKey",
      r."level" AS "roleLevel",
      rp."grants"    AS "rolePermissions",
      up."overrides" AS "userPermissions"
    FROM "User" u
    JOIN "Role" r ON r."id" = u."roleId"
    LEFT JOIN LATERAL (
      SELECT json_agg(json_build_object('key', p."key", 'scope', rp."scope")) AS "grants"
      FROM "RolePermission" rp
      JOIN "Permission" p ON p."id" = rp."permissionId"
      WHERE rp."roleId" = u."roleId"
    ) rp ON TRUE
    LEFT JOIN LATERAL (
      SELECT json_agg(
               json_build_object('key', p."key", 'scope', up."scope", 'granted', up."granted")
             ) AS "overrides"
      FROM "UserPermission" up
      JOIN "Permission" p ON p."id" = up."permissionId"
      WHERE up."userId" = u."id"
    ) up ON TRUE
    WHERE u."id" = ${userId}
      AND u."deletedAt" IS NULL
      AND u."status" = 'ACTIVE'::"UserStatus"
    LIMIT 1
  `;

  const row = rows[0];
  if (!row) return null;

  const scopes: Record<string, 'ALL' | 'TEAM' | 'OWN'> = {};
  const granted = new Set<string>();

  for (const grant of row.rolePermissions ?? []) {
    granted.add(grant.key);
    scopes[grant.key] = grant.scope;
  }

  // Per-user overrides win over the role, in both directions: an explicit
  // grant adds a permission the role lacks, an explicit deny removes one it
  // has. Order matters — overrides must be applied after role grants.
  for (const override of row.userPermissions ?? []) {
    if (override.granted) {
      granted.add(override.key);
      scopes[override.key] = override.scope;
    } else {
      granted.delete(override.key);
      delete scopes[override.key];
    }
  }

  const principal: AuthPrincipal = {
    userId: row.id,
    organizationId: row.organizationId,
    email: row.email,
    name: row.name,
    roleId: row.roleId,
    roleKey: row.roleKey,
    roleLevel: row.roleLevel,
    teamId: row.teamId,
    clientId: row.clientId,
    permissions: [...granted] as Permission[],
    permissionScopes: scopes,
  };

  // Bound the map so a long-lived instance serving many users cannot grow
  // without limit. Oldest insertion first — Map preserves insertion order.
  if (principalCache.size >= PRINCIPAL_CACHE_MAX) {
    const oldest = principalCache.keys().next();
    if (!oldest.done) principalCache.delete(oldest.value);
  }
  principalCache.set(userId, { principal, expiresAt: Date.now() + PRINCIPAL_TTL_MS });

  return principal;
}
