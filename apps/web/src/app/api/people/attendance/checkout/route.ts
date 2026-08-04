import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { ATTENDANCE_INCLUDE, presentAttendance } from '@/lib/server/hrm-present';
import { errorResponse, successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

function todayAtMidnight(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

export async function POST(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.ATTENDANCE_READ], async (principal) => {
    const today = todayAtMidnight();

    const existing = await prisma.attendance.findUnique({
      where: { userId_date: { userId: principal.userId, date: today } },
    });

    if (!existing || !existing.checkInAt) {
      return errorResponse(400, 'VALIDATION_ERROR', 'Check in before checking out');
    }

    const now = new Date();
    const workMinutes = Math.round((now.getTime() - existing.checkInAt.getTime()) / 60_000);

    const record = await prisma.attendance.update({
      where: { id: existing.id },
      data: { checkOutAt: now, workMinutes },
      include: ATTENDANCE_INCLUDE,
    });

    return successResponse(presentAttendance(record));
  });
}
