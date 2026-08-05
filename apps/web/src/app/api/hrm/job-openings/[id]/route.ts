import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';
import { JOB_OPENING_INCLUDE, presentJobOpening } from '@/lib/server/recruitment-present';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

const VALID_STATUSES = new Set(['OPEN', 'ON_HOLD', 'CLOSED']);

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.CANDIDATE_READ], async () => {
    const { id } = await params;

    const opening = await prisma.jobOpening.findFirst({ where: { id }, include: JOB_OPENING_INCLUDE });
    if (!opening) return errorResponse(404, 'NOT_FOUND', 'Job opening not found');

    return successResponse(presentJobOpening(opening));
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.CANDIDATE_MANAGE], async () => {
    const { id } = await params;

    const opening = await prisma.jobOpening.findFirst({ where: { id } });
    if (!opening) return errorResponse(404, 'NOT_FOUND', 'Job opening not found');

    let body: {
      title?: unknown;
      department?: unknown;
      description?: unknown;
      location?: unknown;
      employmentType?: unknown;
      openings?: unknown;
      status?: unknown;
    };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    if (typeof body.status === 'string' && !VALID_STATUSES.has(body.status)) {
      return errorResponse(400, 'VALIDATION_ERROR', `status must be one of: ${[...VALID_STATUSES].join(', ')}`);
    }

    const data: Record<string, unknown> = {};
    if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim();
    if (body.department !== undefined) data.department = typeof body.department === 'string' ? body.department : null;
    if (body.description !== undefined) data.description = typeof body.description === 'string' ? body.description : null;
    if (body.location !== undefined) data.location = typeof body.location === 'string' ? body.location : null;
    if (body.employmentType !== undefined) {
      data.employmentType = typeof body.employmentType === 'string' ? body.employmentType : null;
    }
    if (typeof body.openings === 'number' && body.openings > 0) data.openings = body.openings;
    if (typeof body.status === 'string') data.status = body.status;

    if (Object.keys(data).length === 0) {
      return errorResponse(400, 'VALIDATION_ERROR', 'No supported fields to update');
    }

    const updated = await prisma.jobOpening.update({ where: { id }, data, include: JOB_OPENING_INCLUDE });
    return successResponse(presentJobOpening(updated));
  });
}
