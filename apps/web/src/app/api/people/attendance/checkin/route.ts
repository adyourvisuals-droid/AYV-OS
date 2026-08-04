import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { ATTENDANCE_INCLUDE, presentAttendance } from '@/lib/server/hrm-present';
import { successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

function todayAtMidnight(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

/** Parses "HH:MM" into minutes since midnight. */
function parseClockTime(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

const LATE_GRACE_MINUTES = 15;

/** Checks the caller in for today. Idempotent: re-checking in updates nothing already set. */
export async function POST(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.ATTENDANCE_READ], async (principal) => {
    const today = todayAtMidnight();

    const existing = await prisma.attendance.findUnique({
      where: { userId_date: { userId: principal.userId, date: today } },
    });
    if (existing?.checkInAt) {
      const withUser = await prisma.attendance.findUniqueOrThrow({
        where: { id: existing.id },
        include: ATTENDANCE_INCLUDE,
      });
      return successResponse(presentAttendance(withUser));
    }

    const now = new Date();
    const organization = await prisma.organization.findFirst({
      where: { id: principal.organizationId },
      select: { workDayStart: true },
    });

    const startMinutes = parseClockTime(organization?.workDayStart ?? '10:00');
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const lateMinutes = Math.max(0, nowMinutes - startMinutes - LATE_GRACE_MINUTES);
    const status = lateMinutes > 0 ? 'LATE' : 'PRESENT';

    const record = await prisma.attendance.upsert({
      where: { userId_date: { userId: principal.userId, date: today } },
      update: { checkInAt: now, status, lateMinutes: lateMinutes || null },
      create: {
        organizationId: principal.organizationId,
        userId: principal.userId,
        date: today,
        checkInAt: now,
        status,
        lateMinutes: lateMinutes || null,
        checkInIp: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      },
      include: ATTENDANCE_INCLUDE,
    });

    return successResponse(presentAttendance(record));
  });
}
