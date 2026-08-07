import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';
import { presentPayroll } from '@/lib/server/payroll-present';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

/** Payroll for a given month/year. Defaults to the current month. */
export async function GET(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.PAYROLL_READ], async () => {
    const params = req.nextUrl.searchParams;
    const now = new Date();
    const month = Number(params.get('month')) || now.getUTCMonth() + 1;
    const year = Number(params.get('year')) || now.getUTCFullYear();

    if (month < 1 || month > 12) return errorResponse(400, 'VALIDATION_ERROR', 'month must be 1–12');

    const rows = await prisma.payroll.findMany({
      where: { month, year },
      orderBy: { netPay: 'desc' },
    });

    // Payroll has no Prisma relation to User, so names are joined here.
    const userIds = [...new Set(rows.map((row) => row.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, designation: true },
    });
    const userById = new Map(users.map((user) => [user.id, user]));

    return successResponse(rows.map((row) => presentPayroll(row, userById.get(row.userId))));
  });
}
