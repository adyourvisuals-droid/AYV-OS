import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { briefVisibilityFilter, presentSubmission, SUBMISSION_INCLUDE } from '@/lib/server/creative-present';
import { errorResponse, successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

/**
 * Submits a new version against a brief and moves it into review. Mirrors
 * the status side effects the status route applies for a manual move to
 * IN_REVIEW, so the two paths never disagree on submittedAt.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.CREATIVE_UPDATE], async (principal) => {
    const { id } = await params;

    let body: { fileUrl?: unknown; notes?: unknown };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const brief = await prisma.creativeBrief.findFirst({
      where: { id, ...briefVisibilityFilter(principal) },
    });
    if (!brief) return errorResponse(404, 'NOT_FOUND', 'Brief not found');

    const lastVersion = await prisma.creativeSubmission.findFirst({
      where: { briefId: id },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    const [submission] = await prisma.$transaction([
      prisma.creativeSubmission.create({
        data: {
          briefId: id,
          version: (lastVersion?.version ?? 0) + 1,
          fileUrl: typeof body.fileUrl === 'string' ? body.fileUrl : null,
          notes: typeof body.notes === 'string' ? body.notes : null,
          submittedById: principal.userId,
        },
        include: SUBMISSION_INCLUDE,
      }),
      prisma.creativeBrief.update({
        where: { id },
        data: { status: 'IN_REVIEW', ...(brief.submittedAt ? {} : { submittedAt: new Date() }) },
      }),
    ]);

    return successResponse(presentSubmission(submission));
  });
}
