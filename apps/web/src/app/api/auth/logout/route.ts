import type { NextRequest } from 'next/server';

import { hashToken } from '@/lib/server/auth';
import { prisma } from '@/lib/server/db';
import { successResponse } from '@/lib/server/http';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let body: { refreshToken?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    // A missing or malformed body just means "nothing to revoke" — logout
    // should never fail the client's sign-out flow.
  }

  if (typeof body.refreshToken === 'string' && body.refreshToken) {
    await prisma.session.updateMany({
      where: { refreshTokenHash: hashToken(body.refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  return successResponse({ success: true });
}
