import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { LEAVE_INCLUDE, presentLeave } from '@/lib/server/hrm-present';
import { errorResponse, successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

/** Approves or rejects a pending leave request, crediting the balance on approval. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.LEAVE_APPROVE], async (principal) => {
    const { id } = await params;

    let body: { approved?: unknown; note?: unknown };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const approved = body.approved !== false;
    const note = typeof body.note === 'string' ? body.note : null;

    const leave = await prisma.leave.findFirst({ where: { id } });
    if (!leave) return errorResponse(404, 'NOT_FOUND', 'Leave request not found');
    if (leave.status !== 'PENDING') {
      return errorResponse(400, 'VALIDATION_ERROR', 'This request has already been decided');
    }

    const updated = await prisma.leave.update({
      where: { id },
      data: {
        status: approved ? 'APPROVED' : 'REJECTED',
        approverId: principal.userId,
        decidedAt: new Date(),
        decisionNote: note,
      },
      include: LEAVE_INCLUDE,
    });

    if (approved && leave.type !== 'UNPAID') {
      const year = leave.startDate.getFullYear();
      await prisma.leaveBalance.upsert({
        where: { userId_year_type: { userId: leave.userId, year, type: leave.type } },
        update: { used: { increment: leave.days } },
        create: { userId: leave.userId, year, type: leave.type, entitled: 0, used: leave.days },
      });
    }

    return successResponse(presentLeave(updated));
  });
}
