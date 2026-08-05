import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';
import { CANDIDATE_INCLUDE, CANDIDATE_STAGES, presentCandidate } from '@/lib/server/recruitment-present';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

/** Candidates for one job opening, bucketed by pipeline stage. Mirrors the lead and project boards. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.CANDIDATE_READ], async () => {
    const { id } = await params;

    const opening = await prisma.jobOpening.findFirst({ where: { id }, select: { id: true } });
    if (!opening) return errorResponse(404, 'NOT_FOUND', 'Job opening not found');

    const candidates = await prisma.candidate.findMany({
      where: { jobOpeningId: id },
      include: CANDIDATE_INCLUDE,
      orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
    });

    const columns = CANDIDATE_STAGES.map((stage) => {
      const stageCandidates = candidates.filter((candidate) => candidate.stage === stage);
      return {
        stage,
        count: stageCandidates.length,
        candidates: stageCandidates.map((candidate) => presentCandidate(candidate)),
      };
    });

    return successResponse(columns);
  });
}
