import type { NextRequest } from 'next/server';
import type { Prisma } from '../../../../../generated/prisma';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { countWorkingDays, LEAVE_INCLUDE, leaveVisibilityFilter, presentLeave } from '@/lib/server/hrm-present';
import { errorResponse, successResponse } from '@/lib/server/http';
import { ListQuery } from '@/lib/server/list-query';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

const VALID_TYPES = new Set(['CASUAL', 'SICK', 'EARNED', 'UNPAID', 'MATERNITY', 'PATERNITY', 'COMP_OFF']);

export async function GET(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.LEAVE_READ], async (principal) => {
    const query = new ListQuery(req.nextUrl.searchParams);
    const status = query.get('status');
    const userId = query.get('userId');

    const where: Prisma.LeaveWhereInput = {
      ...leaveVisibilityFilter(principal),
      ...(status ? { status: status as never } : {}),
      ...(userId ? { userId } : {}),
    };

    const rows = await prisma.leave.findMany({
      where,
      include: LEAVE_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: query.limit,
    });

    return successResponse(rows.map((row) => presentLeave(row)));
  });
}

/** Requests leave. Mirrors the LEAVE_CREATE (own-scope) grant every role holds. */
export async function POST(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.LEAVE_CREATE], async (principal) => {
    let body: { type?: unknown; startDate?: unknown; endDate?: unknown; reason?: unknown };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const type = typeof body.type === 'string' && VALID_TYPES.has(body.type) ? body.type : null;
    const startDate =
      typeof body.startDate === 'string' && !Number.isNaN(Date.parse(body.startDate))
        ? new Date(body.startDate)
        : null;
    const endDate =
      typeof body.endDate === 'string' && !Number.isNaN(Date.parse(body.endDate))
        ? new Date(body.endDate)
        : null;

    if (!type || !startDate || !endDate || endDate < startDate) {
      return errorResponse(
        400,
        'VALIDATION_ERROR',
        'type, startDate and endDate are required, and endDate must not be before startDate',
      );
    }

    const organization = await prisma.organization.findFirst({
      where: { id: principal.organizationId },
      select: { workingDays: true },
    });

    const days = countWorkingDays(startDate, endDate, organization?.workingDays ?? [1, 2, 3, 4, 5, 6]);
    if (days <= 0) {
      return errorResponse(400, 'VALIDATION_ERROR', 'The selected range has no working days');
    }

    const created = await prisma.leave.create({
      data: {
        organizationId: principal.organizationId,
        userId: principal.userId,
        type: type as never,
        status: 'PENDING',
        startDate,
        endDate,
        days,
        reason: typeof body.reason === 'string' ? body.reason : null,
      },
      include: LEAVE_INCLUDE,
    });

    return successResponse(presentLeave(created));
  });
}
