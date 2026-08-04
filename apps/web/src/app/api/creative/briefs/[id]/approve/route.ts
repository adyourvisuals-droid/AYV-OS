import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { BRIEF_INCLUDE, briefVisibilityFilter, presentBrief } from '@/lib/server/creative-present';
import { errorResponse, successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

/**
 * Approves and delivers a brief: records an Approval row and moves the
 * brief to DELIVERED, computing turnaround the same way the status route
 * does for a manual move — the two paths always agree.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.APPROVAL_DECIDE], async (principal) => {
    const { id } = await params;

    let body: { comment?: unknown; isClientApproval?: unknown };
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const brief = await prisma.creativeBrief.findFirst({
      where: { id, ...briefVisibilityFilter(principal) },
    });
    if (!brief) return errorResponse(404, 'NOT_FOUND', 'Brief not found');

    const now = new Date();

    const [, updated] = await prisma.$transaction([
      prisma.approval.create({
        data: {
          organizationId: principal.organizationId,
          entityType: 'CreativeBrief',
          entityId: id,
          briefId: id,
          status: 'APPROVED',
          approverId: principal.userId,
          isClientApproval: body.isClientApproval === true,
          comment: typeof body.comment === 'string' ? body.comment : null,
          requestedAt: now,
          decidedAt: now,
        },
      }),
      prisma.creativeBrief.update({
        where: { id },
        data: {
          status: 'DELIVERED',
          ...(brief.deliveredAt
            ? {}
            : {
                deliveredAt: now,
                turnaroundHours: Math.round((now.getTime() - brief.createdAt.getTime()) / 3_600_000),
              }),
        },
        include: BRIEF_INCLUDE,
      }),
    ]);

    return successResponse(presentBrief(updated));
  });
}
