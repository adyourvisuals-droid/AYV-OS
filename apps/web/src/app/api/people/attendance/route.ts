import type { NextRequest } from 'next/server';
import type { Prisma } from '../../../../../generated/prisma';
import { startOfMonth, endOfMonth } from 'date-fns';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { ATTENDANCE_INCLUDE, attendanceVisibilityFilter, presentAttendance } from '@/lib/server/hrm-present';
import { successResponse } from '@/lib/server/http';
import { ListQuery } from '@/lib/server/list-query';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

/** This month's attendance, scoped to what the caller's ATTENDANCE_READ scope allows. */
export async function GET(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.ATTENDANCE_READ], async (principal) => {
    const query = new ListQuery(req.nextUrl.searchParams);
    const userId = query.get('userId');

    const where: Prisma.AttendanceWhereInput = {
      ...attendanceVisibilityFilter(principal),
      ...(userId ? { userId } : {}),
      date: { gte: startOfMonth(new Date()), lte: endOfMonth(new Date()) },
    };

    const rows = await prisma.attendance.findMany({
      where,
      include: ATTENDANCE_INCLUDE,
      orderBy: { date: 'desc' },
      take: query.limit,
    });

    return successResponse(rows.map((row) => presentAttendance(row)));
  });
}
