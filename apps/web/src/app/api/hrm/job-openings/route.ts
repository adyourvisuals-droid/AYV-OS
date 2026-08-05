import type { NextRequest } from 'next/server';
import type { Prisma } from '../../../../../generated/prisma';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';
import { ListQuery } from '@/lib/server/list-query';
import { JOB_OPENING_INCLUDE, presentJobOpening } from '@/lib/server/recruitment-present';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.CANDIDATE_READ], async () => {
    const query = new ListQuery(req.nextUrl.searchParams);
    const status = query.get('status');

    const where: Prisma.JobOpeningWhereInput = {
      ...(status ? { status } : {}),
      ...(query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {}),
      ...(query.deleted ? { deletedAt: { not: null } } : {}),
    };

    const rows = await prisma.jobOpening.findMany({
      where,
      include: JOB_OPENING_INCLUDE,
      orderBy: query.orderBy(['createdAt', 'title', 'status'], [{ createdAt: 'desc' }]),
      skip: query.skip,
      take: query.limit,
    });

    return successResponse(rows.map((row) => presentJobOpening(row)));
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.CANDIDATE_MANAGE], async (principal) => {
    let body: {
      title?: unknown;
      department?: unknown;
      description?: unknown;
      location?: unknown;
      employmentType?: unknown;
      openings?: unknown;
    };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) return errorResponse(400, 'VALIDATION_ERROR', 'title is required');

    const created = await prisma.jobOpening.create({
      data: {
        organizationId: principal.organizationId,
        title,
        department: typeof body.department === 'string' ? body.department : null,
        description: typeof body.description === 'string' ? body.description : null,
        location: typeof body.location === 'string' ? body.location : null,
        employmentType: typeof body.employmentType === 'string' ? body.employmentType : null,
        openings: typeof body.openings === 'number' && body.openings > 0 ? body.openings : 1,
        status: 'OPEN',
      },
      include: JOB_OPENING_INCLUDE,
    });

    return successResponse(presentJobOpening(created));
  });
}
