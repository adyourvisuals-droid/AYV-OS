import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { briefVisibilityFilter } from '@/lib/server/creative-present';
import { errorResponse, successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

/**
 * Requests a revision on the latest submission and sends the brief back
 * into production. `revisionCount` is what the UI compares against
 * `revisionLimit` to flag a billable change order.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.CREATIVE_UPDATE], async (principal) => {
    const { id } = await params;

    let body: { note?: unknown; fromClient?: unknown };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const note = typeof body.note === 'string' ? body.note.trim() : '';
    if (!note) return errorResponse(400, 'VALIDATION_ERROR', 'note is required');

    const brief = await prisma.creativeBrief.findFirst({
      where: { id, ...briefVisibilityFilter(principal) },
    });
    if (!brief) return errorResponse(404, 'NOT_FOUND', 'Brief not found');

    const lastSubmission = await prisma.creativeSubmission.findFirst({
      where: { briefId: id },
      orderBy: { version: 'desc' },
    });
    if (!lastSubmission) {
      return errorResponse(400, 'VALIDATION_ERROR', 'No submission exists yet to request a revision on');
    }

    await prisma.$transaction([
      prisma.revision.create({
        data: {
          submissionId: lastSubmission.id,
          requestedById: principal.userId,
          fromClient: body.fromClient === true,
          note,
        },
      }),
      prisma.creativeBrief.update({
        where: { id },
        data: { status: 'IN_PROGRESS', revisionCount: { increment: 1 } },
      }),
    ]);

    const updated = await prisma.creativeBrief.findFirstOrThrow({ where: { id } });

    return successResponse({
      revisionCount: updated.revisionCount,
      revisionLimit: updated.revisionLimit,
      isOverRevisionLimit: updated.revisionCount >= updated.revisionLimit,
    });
  });
}
