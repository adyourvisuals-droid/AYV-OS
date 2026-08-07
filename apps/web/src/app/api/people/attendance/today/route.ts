import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { attendanceDay } from '@/lib/server/attendance-day';
import { prisma } from '@/lib/server/db';
import { ATTENDANCE_INCLUDE, presentAttendance } from '@/lib/server/hrm-present';
import { successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

/**
 * The caller's own attendance record for today, or null. The server is the
 * single authority on which calendar day "today" is (in the org timezone),
 * so the check-in/check-out card never has to guess it from a list and a
 * timezone-fragile date comparison.
 */
export async function GET(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.ATTENDANCE_READ], async (principal) => {
    const organization = await prisma.organization.findFirst({
      where: { id: principal.organizationId },
      select: { timezone: true },
    });
    const today = attendanceDay(organization?.timezone ?? 'Asia/Kolkata');

    const record = await prisma.attendance.findUnique({
      where: { userId_date: { userId: principal.userId, date: today } },
      include: ATTENDANCE_INCLUDE,
    });

    return successResponse(record ? presentAttendance(record) : null);
  });
}
