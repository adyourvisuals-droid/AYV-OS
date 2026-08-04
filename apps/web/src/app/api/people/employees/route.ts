import type { NextRequest } from 'next/server';
import type { Prisma } from '../../../../../generated/prisma';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { successResponse } from '@/lib/server/http';
import { ListQuery } from '@/lib/server/list-query';
import { EMPLOYEE_SELECT, presentEmployee } from '@/lib/server/hrm-present';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.EMPLOYEE_READ], async () => {
    const query = new ListQuery(req.nextUrl.searchParams);
    const department = query.get('department');

    const where: Prisma.UserWhereInput = {
      userType: 'EMPLOYEE',
      ...(department ? { department } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { designation: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const rows = await prisma.user.findMany({
      where,
      select: EMPLOYEE_SELECT,
      orderBy: { name: 'asc' },
      take: query.limit,
    });

    return successResponse(rows.map((row) => presentEmployee(row)));
  });
}
