import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';
import { CANDIDATE_INCLUDE, presentCandidate } from '@/lib/server/recruitment-present';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.CANDIDATE_READ], async () => {
    const { id } = await params;

    const candidate = await prisma.candidate.findFirst({ where: { id }, include: CANDIDATE_INCLUDE });
    if (!candidate) return errorResponse(404, 'NOT_FOUND', 'Candidate not found');

    return successResponse(presentCandidate(candidate));
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.CANDIDATE_MANAGE], async () => {
    const { id } = await params;

    const candidate = await prisma.candidate.findFirst({ where: { id } });
    if (!candidate) return errorResponse(404, 'NOT_FOUND', 'Candidate not found');

    let body: {
      name?: unknown;
      email?: unknown;
      phone?: unknown;
      resumeUrl?: unknown;
      score?: unknown;
      screeningNotes?: unknown;
    };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const data: Record<string, unknown> = {};
    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim();
    if (body.email !== undefined) data.email = typeof body.email === 'string' ? body.email : null;
    if (body.phone !== undefined) data.phone = typeof body.phone === 'string' ? body.phone : null;
    if (body.resumeUrl !== undefined) data.resumeUrl = typeof body.resumeUrl === 'string' ? body.resumeUrl : null;
    if (body.screeningNotes !== undefined) {
      data.screeningNotes = typeof body.screeningNotes === 'string' ? body.screeningNotes : null;
    }
    if (typeof body.score === 'number' && body.score >= 0 && body.score <= 100) data.score = body.score;

    if (Object.keys(data).length === 0) {
      return errorResponse(400, 'VALIDATION_ERROR', 'No supported fields to update');
    }

    const updated = await prisma.candidate.update({ where: { id }, data, include: CANDIDATE_INCLUDE });
    return successResponse(presentCandidate(updated));
  });
}
