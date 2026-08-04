import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import {
  BRIEF_INCLUDE,
  briefVisibilityFilter,
  presentApproval,
  presentBrief,
  presentSubmission,
  SUBMISSION_INCLUDE,
} from '@/lib/server/creative-present';
import { errorResponse, successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

/** Brief detail with submission history (each with its revisions) and approvals. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.CREATIVE_READ], async (principal) => {
    const { id } = await params;

    const brief = await prisma.creativeBrief.findFirst({
      where: { id, ...briefVisibilityFilter(principal) },
      include: BRIEF_INCLUDE,
    });
    if (!brief) return errorResponse(404, 'NOT_FOUND', 'Brief not found');

    const [submissions, approvals] = await Promise.all([
      prisma.creativeSubmission.findMany({
        where: { briefId: id },
        include: SUBMISSION_INCLUDE,
        orderBy: { version: 'desc' },
      }),
      prisma.approval.findMany({
        where: { briefId: id },
        orderBy: { requestedAt: 'desc' },
      }),
    ]);

    return successResponse({
      ...presentBrief(brief),
      submissions: submissions.map((submission) => presentSubmission(submission)),
      approvals: approvals.map((approval) => presentApproval(approval)),
    });
  });
}
