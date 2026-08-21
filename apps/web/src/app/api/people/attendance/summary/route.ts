import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { attendanceMonthRangeFor } from '@/lib/server/attendance-day';
import { prisma } from '@/lib/server/db';
import { attendanceVisibilityFilter } from '@/lib/server/hrm-present';
import { errorResponse, successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

/**
 * A person's month at a glance: totals (present, late, absent-ish, leave),
 * total and average hours, plus a per-day series so the UI can draw a
 * timesheet strip. Defaults to the caller; a manager can pass ?userId.
 */
export async function GET(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.ATTENDANCE_READ], async (principal) => {
    const query = req.nextUrl.searchParams;
    const now = new Date();
    const month = Number(query.get('month')) || now.getUTCMonth() + 1;
    const year = Number(query.get('year')) || now.getUTCFullYear();
    if (month < 1 || month > 12) return errorResponse(400, 'VALIDATION_ERROR', 'month must be 1–12');

    const userId = query.get('userId') || principal.userId;
    const { start, end } = attendanceMonthRangeFor(month, year);

    const rows = await prisma.attendance.findMany({
      where: {
        ...attendanceVisibilityFilter(principal),
        userId,
        date: { gte: start, lte: end },
      },
      orderBy: { date: 'asc' },
      select: { id: true, date: true, status: true, checkInAt: true, checkOutAt: true, workMinutes: true, lateMinutes: true },
    });

    const totalMinutes = rows.reduce((sum, row) => sum + (row.workMinutes ?? 0), 0);
    const presentDays = rows.filter((row) => row.checkInAt).length;
    const lateDays = rows.filter((row) => (row.lateMinutes ?? 0) > 0).length;
    const leaveDays = rows.filter((row) => row.status === 'LEAVE').length;

    return successResponse({
      period: { month, year },
      totals: {
        presentDays,
        lateDays,
        leaveDays,
        totalMinutes,
        avgMinutes: presentDays > 0 ? Math.round(totalMinutes / presentDays) : 0,
      },
      days: rows.map((row) => ({
        date: row.date.toISOString(),
        status: row.status,
        checkInAt: row.checkInAt?.toISOString() ?? null,
        checkOutAt: row.checkOutAt?.toISOString() ?? null,
        workMinutes: row.workMinutes,
        lateMinutes: row.lateMinutes,
      })),
    });
  });
}
