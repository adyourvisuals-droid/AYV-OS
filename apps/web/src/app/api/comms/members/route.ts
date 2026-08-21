import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

/** Active teammates the caller can start a direct message with. */
export async function GET(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.COMM_USE], async (principal) => {
    const users = await prisma.user.findMany({
      where: { status: 'ACTIVE', id: { not: principal.userId }, role: { key: { not: 'CLIENT' } } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, avatarUrl: true, designation: true, department: true },
    });
    return successResponse(users);
  });
}
