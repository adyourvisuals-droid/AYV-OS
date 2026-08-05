import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';
import { CANDIDATE_INCLUDE, presentCandidate } from '@/lib/server/recruitment-present';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.CANDIDATE_MANAGE], async () => {
    const { id: jobOpeningId } = await params;

    const opening = await prisma.jobOpening.findFirst({ where: { id: jobOpeningId }, select: { id: true } });
    if (!opening) return errorResponse(404, 'NOT_FOUND', 'Job opening not found');

    let body: { name?: unknown; email?: unknown; phone?: unknown; resumeUrl?: unknown };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return errorResponse(400, 'VALIDATION_ERROR', 'name is required');

    const created = await prisma.candidate.create({
      data: {
        jobOpeningId,
        name,
        email: typeof body.email === 'string' ? body.email : null,
        phone: typeof body.phone === 'string' ? body.phone : null,
        resumeUrl: typeof body.resumeUrl === 'string' ? body.resumeUrl : null,
        stage: 'APPLIED',
      },
      include: CANDIDATE_INCLUDE,
    });

    return successResponse(presentCandidate(created));
  });
}
