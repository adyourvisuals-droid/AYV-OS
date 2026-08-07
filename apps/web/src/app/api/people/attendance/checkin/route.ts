import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { attendanceDay } from '@/lib/server/attendance-day';
import { prisma } from '@/lib/server/db';
import { ATTENDANCE_INCLUDE, presentAttendance } from '@/lib/server/hrm-present';
import { successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

/** Parses "HH:MM" into minutes since midnight. */
function parseClockTime(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

/** Wall-clock minutes-since-midnight of `now` in the given timezone. */
function localMinutes(timezone: string, now: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return hour * 60 + minute;
}

const LATE_GRACE_MINUTES = 15;

/** Checks the caller in for today. Idempotent: re-checking in updates nothing already set. */
export async function POST(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.ATTENDANCE_READ], async (principal) => {
    const now = new Date();
    const organization = await prisma.organization.findFirst({
      where: { id: principal.organizationId },
      select: { workDayStart: true, timezone: true },
    });
    const timezone = organization?.timezone ?? 'Asia/Kolkata';
    const today = attendanceDay(timezone, now);

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

    const startMinutes = parseClockTime(organization?.workDayStart ?? '10:00');
    const nowMinutes = localMinutes(timezone, now);
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
