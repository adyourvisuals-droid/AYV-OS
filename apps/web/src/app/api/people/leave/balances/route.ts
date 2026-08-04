import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { DEFAULT_LEAVE_ENTITLEMENTS } from '@/lib/server/hrm-present';
import { successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

/**
 * Leave balances for the current year. Lazily seeds the standard
 * entitlements (see DEFAULT_LEAVE_ENTITLEMENTS) the first time a user's
 * balances are read, rather than requiring a separate HR provisioning step.
 */
export async function GET(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.LEAVE_READ], async (principal) => {
    const requestedUserId = req.nextUrl.searchParams.get('userId');
    const canViewOthers = principal.permissions.includes(PERMISSIONS.LEAVE_APPROVE);
    const userId = requestedUserId && canViewOthers ? requestedUserId : principal.userId;

    const year = new Date().getFullYear();

    const existing = await prisma.leaveBalance.findMany({ where: { userId, year } });

    if (existing.length === 0) {
      await prisma.leaveBalance.createMany({
        data: DEFAULT_LEAVE_ENTITLEMENTS.map((entry) => ({
          userId,
          year,
          type: entry.type as never,
          entitled: entry.entitled,
          used: 0,
        })),
        skipDuplicates: true,
      });
    }

    const balances = await prisma.leaveBalance.findMany({ where: { userId, year } });

    return successResponse(
      balances.map((balance) => ({
        type: balance.type,
        entitled: Number(balance.entitled),
        used: Number(balance.used),
        remaining: Number(balance.entitled) - Number(balance.used),
      })),
    );
  });
}
