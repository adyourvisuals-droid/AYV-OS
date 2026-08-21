import type { NextRequest } from 'next/server';
import type { Prisma } from '../../../../../../generated/prisma';

import { PERMISSIONS } from '@ayv/types';

import { attendanceDay } from '@/lib/server/attendance-day';
import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';
import { scopeOf } from '@/lib/server/scope';

export const runtime = 'nodejs';

/**
 * The live "who's in now" board — every visible team member with their
 * status for today: in (checked in, not out), out (finished), on leave, or
 * absent (a working day with no check-in). This is the at-a-glance answer to
 * "who's working right now", not a historical log.
 */
export async function GET(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.ATTENDANCE_READ], async (principal) => {
    const organization = await prisma.organization.findFirst({
      where: { id: principal.organizationId },
      select: { timezone: true },
    });
    const tz = organization?.timezone ?? 'Asia/Kolkata';
    const today = attendanceDay(tz);

    // Who can this caller see? All active staff, just their team, or only self.
    const scope = scopeOf(principal, PERMISSIONS.ATTENDANCE_READ);
    let userWhere: Prisma.UserWhereInput = { status: 'ACTIVE' };
    if (scope === 'OWN') {
      userWhere = { id: principal.userId };
    } else if (scope === 'TEAM') {
      userWhere = principal.teamId
        ? { status: 'ACTIVE', OR: [{ id: principal.userId }, { teamId: principal.teamId }] }
        : { id: principal.userId };
    }

    const [users, todays, approvedLeaves] = await Promise.all([
      prisma.user.findMany({
        where: userWhere,
        select: { id: true, name: true, avatarUrl: true, designation: true, department: true },
        orderBy: { name: 'asc' },
      }),
      prisma.attendance.findMany({
        where: { date: today },
        select: { userId: true, checkInAt: true, checkOutAt: true, status: true, workMinutes: true, lateMinutes: true },
      }),
      prisma.leave.findMany({
        where: { status: 'APPROVED', startDate: { lte: today }, endDate: { gte: today } },
        select: { userId: true },
      }),
    ]);

    const byUser = new Map(todays.map((row) => [row.userId, row]));
    const onLeave = new Set(approvedLeaves.map((leave) => leave.userId));
    const now = Date.now();

    const people = users.map((user) => {
      const record = byUser.get(user.id);
      let state: 'in' | 'out' | 'leave' | 'absent';
      if (record?.checkInAt && !record.checkOutAt) state = 'in';
      else if (record?.checkOutAt) state = 'out';
      else if (onLeave.has(user.id)) state = 'leave';
      else state = 'absent';

      // Live minutes for someone still clocked in — clamped so clock skew or a
      // future-dated check-in can never render a negative duration.
      const liveMinutes =
        state === 'in' && record?.checkInAt
          ? Math.max(0, Math.round((now - new Date(record.checkInAt).getTime()) / 60_000))
          : (record?.workMinutes ?? null);

      return {
        user: { id: user.id, name: user.name, avatarUrl: user.avatarUrl, designation: user.designation, department: user.department },
        state,
        checkInAt: record?.checkInAt?.toISOString() ?? null,
        checkOutAt: record?.checkOutAt?.toISOString() ?? null,
        status: record?.status ?? null,
        lateMinutes: record?.lateMinutes ?? null,
        minutes: liveMinutes,
      };
    });

    const summary = {
      total: people.length,
      in: people.filter((p) => p.state === 'in').length,
      out: people.filter((p) => p.state === 'out').length,
      leave: people.filter((p) => p.state === 'leave').length,
      absent: people.filter((p) => p.state === 'absent').length,
      late: people.filter((p) => (p.lateMinutes ?? 0) > 0).length,
    };

    return successResponse({ date: today.toISOString(), summary, people });
  });
}

// Guard against accidental misuse of other verbs.
export async function POST() {
  return errorResponse(405, 'VALIDATION_ERROR', 'Method not allowed');
}
