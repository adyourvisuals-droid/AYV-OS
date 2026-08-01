import type { NextRequest } from 'next/server';

import { getDummyHash, issueSession, loadPrincipal, verifyPassword } from '@/lib/server/auth';
import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';

// argon2 native bindings and node:crypto require the Node.js runtime, not Edge.
export const runtime = 'nodejs';

function clientIp(req: NextRequest): string | null {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
}

export async function POST(req: NextRequest) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
  }

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

  const principal = await loadPrincipal(user.id);
  if (!principal) {
    return errorResponse(401, 'UNAUTHENTICATED', 'Invalid email or password');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), lastActiveAt: new Date() },
  });

  const session = await issueSession(principal, {
    userAgent: req.headers.get('user-agent'),
    ipAddress: clientIp(req),
  });

  return successResponse(session);
}
