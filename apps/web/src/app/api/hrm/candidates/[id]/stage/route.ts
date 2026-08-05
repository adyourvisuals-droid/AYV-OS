import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';
import { CANDIDATE_INCLUDE, CANDIDATE_STAGES, presentCandidate } from '@/lib/server/recruitment-present';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

/** Moves a candidate between pipeline stages. Mirrors LeadsService#moveStage. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.CANDIDATE_MANAGE], async () => {
    const { id } = await params;

    let body: { stage?: unknown; rejectionReason?: unknown };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const stage = typeof body.stage === 'string' ? body.stage : '';
    if (!(CANDIDATE_STAGES as readonly string[]).includes(stage)) {
      return errorResponse(400, 'VALIDATION_ERROR', `stage must be one of: ${CANDIDATE_STAGES.join(', ')}`);
    }

    const candidate = await prisma.candidate.findFirst({ where: { id } });
    if (!candidate) return errorResponse(404, 'NOT_FOUND', 'Candidate not found');

    if (stage === 'REJECTED' && typeof body.rejectionReason !== 'string') {
      return errorResponse(400, 'VALIDATION_ERROR', 'A reason is required when rejecting a candidate');
    }

    const updated = await prisma.candidate.update({
      where: { id },
      data: {
        stage: stage as never,
        ...(stage === 'REJECTED' ? { rejectionReason: body.rejectionReason as string } : {}),
      },
      include: CANDIDATE_INCLUDE,
    });

    return successResponse(presentCandidate(updated));
  });
}
