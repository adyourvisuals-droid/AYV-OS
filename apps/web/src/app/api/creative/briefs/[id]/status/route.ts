import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { BRIEF_INCLUDE, briefVisibilityFilter, presentBrief } from '@/lib/server/creative-present';
import { errorResponse, successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

const VALID_STATUSES = new Set(['QUEUED', 'IN_PROGRESS', 'IN_REVIEW', 'DELIVERED']);

/** Moves a brief on the production board. Mirrors the Task move endpoint's pattern. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.CREATIVE_UPDATE], async (principal) => {
    const { id } = await params;

    let body: { status?: unknown };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const status = typeof body.status === 'string' ? body.status : null;
    if (!status || !VALID_STATUSES.has(status)) {
      return errorResponse(400, 'VALIDATION_ERROR', `status must be one of: ${[...VALID_STATUSES].join(', ')}`);
    }

    const brief = await prisma.creativeBrief.findFirst({
      where: { id, ...briefVisibilityFilter(principal) },
    });
    if (!brief) return errorResponse(404, 'NOT_FOUND', 'Brief not found');

    const now = new Date();
    const updated = await prisma.creativeBrief.update({
      where: { id },
      data: {
        status,
        ...(status === 'IN_REVIEW' && !brief.submittedAt ? { submittedAt: now } : {}),
        ...(status === 'DELIVERED' && !brief.deliveredAt
          ? {
              deliveredAt: now,
              turnaroundHours: Math.round((now.getTime() - brief.createdAt.getTime()) / 3_600_000),
            }
          : {}),
      },
      include: BRIEF_INCLUDE,
    });

    return successResponse(presentBrief(updated));
  });
}
