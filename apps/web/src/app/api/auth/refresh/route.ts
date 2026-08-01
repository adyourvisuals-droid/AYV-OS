import type { NextRequest } from 'next/server';

import {
  hashToken,
  issueSession,
  loadPrincipal,
  revokeSessionFamily,
  verifyRefreshToken,
} from '@/lib/server/auth';
import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';

export const runtime = 'nodejs';

function clientIp(req: NextRequest): string | null {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
}

/**
 * Rotates the refresh token.
 *
 * Every refresh mints a new token and revokes the presented one. If a token
 * that has already been used is presented again, the entire session family
 * is revoked — see docs/01-architecture.md §8.
 */
export async function POST(req: NextRequest) {
  let body: { refreshToken?: unknown };
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
  }

  const refreshToken = typeof body.refreshToken === 'string' ? body.refreshToken : '';
  if (!refreshToken) {
    return errorResponse(400, 'VALIDATION_ERROR', 'refreshToken is required');
  }

  let payload;
  try {
    payload = await verifyRefreshToken(refreshToken);
  } catch {
    return errorResponse(401, 'UNAUTHENTICATED', 'Invalid or expired refresh token');
  }

  const tokenHash = hashToken(refreshToken);
  const stored = await prisma.session.findFirst({ where: { refreshTokenHash: tokenHash } });

  if (!stored) {
    // The token verifies but is not on record: it was already rotated away.
    // Treat the whole family as compromised.
    await revokeSessionFamily(payload.family);
    return errorResponse(401, 'UNAUTHENTICATED', 'Session revoked. Please sign in again.');
  }

  if (stored.revokedAt) {
    await revokeSessionFamily(stored.familyId);
    return errorResponse(401, 'UNAUTHENTICATED', 'Session revoked. Please sign in again.');
  }

  if (stored.expiresAt < new Date()) {
    return errorResponse(401, 'UNAUTHENTICATED', 'Session expired. Please sign in again.');
  }

  await prisma.session.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });

  const principal = await loadPrincipal(stored.userId);
  if (!principal) {
    return errorResponse(401, 'UNAUTHENTICATED', 'Account is no longer active');
  }

  const session = await issueSession(
    principal,
    { userAgent: req.headers.get('user-agent'), ipAddress: clientIp(req) },
    stored.familyId,
  );

  return successResponse(session);
}
