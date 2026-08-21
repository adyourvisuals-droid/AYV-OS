import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { ATTENDANCE_INCLUDE, presentAttendance } from '@/lib/server/hrm-present';
import { errorResponse, successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

/**
 * Manager correction of an attendance record — fix a missed check-out, adjust
 * times, override the status, or leave a note. Work minutes are recomputed
 * from the times so the timesheet stays consistent, never hand-entered.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.ATTENDANCE_MANAGE], async () => {
    const { id } = await params;

    const existing = await prisma.attendance.findFirst({ where: { id } });
    if (!existing) return errorResponse(404, 'NOT_FOUND', 'Attendance record not found');

    let body: { checkInAt?: unknown; checkOutAt?: unknown; status?: unknown; note?: unknown };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const parseTime = (value: unknown): Date | null | undefined => {
      if (value === null) return null;
      if (typeof value !== 'string' || !value) return undefined;
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? undefined : parsed;
    };

    const checkInAt = parseTime(body.checkInAt);
    const checkOutAt = parseTime(body.checkOutAt);

    const data: Record<string, unknown> = {};
    if (checkInAt !== undefined) data.checkInAt = checkInAt;
    if (checkOutAt !== undefined) data.checkOutAt = checkOutAt;
    if (typeof body.status === 'string') data.status = body.status;
    if (typeof body.note === 'string') data.note = body.note || null;

    // Recompute worked minutes whenever either boundary is in play.
    const effectiveIn = checkInAt !== undefined ? checkInAt : existing.checkInAt;
    const effectiveOut = checkOutAt !== undefined ? checkOutAt : existing.checkOutAt;
    if (effectiveIn && effectiveOut) {
      data.workMinutes = Math.max(0, Math.round((effectiveOut.getTime() - effectiveIn.getTime()) / 60_000));
    } else if (checkOutAt === null) {
      data.workMinutes = null;
    }

    if (Object.keys(data).length === 0) {
      return errorResponse(400, 'VALIDATION_ERROR', 'Nothing to update');
    }

    const updated = await prisma.attendance.update({
      where: { id },
      data,
      include: ATTENDANCE_INCLUDE,
    });

    return successResponse(presentAttendance(updated));
  });
}
