import type { NextRequest } from 'next/server';

import { getDummyHash, issueSession, loadPrincipal, verifyPassword } from '@/lib/server/auth';
import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';

// argon2 native bindings and node:crypto require the Node.js runtime, not Edge.
export const runtime = 'nodejs';

function clientIp(req: NextRequest): string | null {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
}

/**
 * Everything below the body parse runs inside a try/catch so that an
 * infrastructure failure (unreachable database, missing secret) returns a
 * JSON error envelope. Without it, the exception escapes to Next.js, which
 * renders an HTML error page — and the client's `response.json()` then fails
 * with the unhelpful "The server returned an unreadable response" rather
 * than the actual cause.
 */
export async function POST(req: NextRequest) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
  }

  try {
    return await handleLogin(req, body);
  } catch (error) {
    return errorResponse(
      500,
      'INTERNAL_ERROR',
      error instanceof Error ? error.message : 'Login failed unexpectedly',
    );
  }
}

async function handleLogin(req: NextRequest, body: { email?: unknown; password?: unknown }) {

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !password) {
    return errorResponse(400, 'VALIDATION_ERROR', 'Email and password are required');
  }

  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null },
    select: { id: true, passwordHash: true, status: true },
  });

  // Always verify against *something* so a missing account and a wrong
  // password take indistinguishable time.
  const hashToCheck = user?.passwordHash ?? (await getDummyHash());
  const matches = await verifyPassword(hashToCheck, password);

  if (!user || !user.passwordHash || !matches) {
    return errorResponse(401, 'UNAUTHENTICATED', 'Invalid email or password');
  }

  if (user.status !== 'ACTIVE') {
    return errorResponse(
      401,
      'UNAUTHENTICATED',
      'This account is not active. Contact your administrator.',
    );
  }

  // Neither depends on the other's result — loadPrincipal only needs the id,
  // and the lastLogin bookkeeping write doesn't need the principal — so they
  // share one round trip instead of paying for two in sequence.
  const [principal] = await Promise.all([
    loadPrincipal(user.id),
    prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastActiveAt: new Date() },
    }),
  ]);
  if (!principal) {
    return errorResponse(401, 'UNAUTHENTICATED', 'Invalid email or password');
  }

  const session = await issueSession(principal, {
    userAgent: req.headers.get('user-agent'),
    ipAddress: clientIp(req),
  });

  return successResponse(session);
}
