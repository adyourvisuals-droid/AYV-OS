import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { assignableUserIds } from '@/lib/server/hierarchy';
import { successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';
import { scopeOf } from '@/lib/server/scope';

export const runtime = 'nodejs';

/**
 * The people the caller may allot work to.
 *
 * Backs the assignee picker so the UI offers exactly the set the server will
 * accept — otherwise a lead would be shown the whole company and get a 403
 * on save. Derived from the same helper the write path uses.
 */
export async function GET(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.TASK_READ], async (principal) => {
    const canAssignOthers = principal.permissions.includes(PERMISSIONS.TASK_ASSIGN);

    // Without TASK_ASSIGN the only permitted assignee is the caller.
    const allowedIds = canAssignOthers
      ? await assignableUserIds(principal, scopeOf(principal, PERMISSIONS.TASK_ASSIGN))
      : [principal.userId];

    const users = await prisma.user.findMany({
      where: {
        status: { not: 'OFFBOARDED' },
        userType: 'EMPLOYEE',
        ...(allowedIds === null ? {} : { id: { in: allowedIds } }),
      },
      select: { id: true, name: true, email: true, avatarUrl: true, designation: true },
      orderBy: { name: 'asc' },
    });

    return successResponse(users);
  });
}
