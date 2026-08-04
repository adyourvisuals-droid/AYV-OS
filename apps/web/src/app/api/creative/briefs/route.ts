import type { NextRequest } from 'next/server';
import type { Prisma } from '../../../../../generated/prisma';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { BRIEF_INCLUDE, briefVisibilityFilter, presentBrief } from '@/lib/server/creative-present';
import { errorResponse, successResponse } from '@/lib/server/http';
import { ListQuery } from '@/lib/server/list-query';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

const SORTABLE_FIELDS = ['createdAt', 'dueDate', 'priority', 'title'];

export async function GET(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.CREATIVE_READ], async (principal) => {
    const query = new ListQuery(req.nextUrl.searchParams);
    const status = query.get('status');
    const type = query.get('type');
    const assigneeId = query.get('assigneeId');
    const clientId = query.get('clientId');

    const where: Prisma.CreativeBriefWhereInput = {
      ...briefVisibilityFilter(principal),
      ...(status ? { status } : {}),
      ...(type ? { type: type as never } : {}),
      ...(assigneeId ? { assigneeId } : {}),
      ...(clientId ? { clientId } : {}),
      ...(query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {}),
    };

    const rows = await prisma.creativeBrief.findMany({
      where,
      include: BRIEF_INCLUDE,
      orderBy: query.orderBy(SORTABLE_FIELDS, [{ createdAt: 'desc' }]),
      take: query.limit,
    });

    return successResponse(rows.map((row) => presentBrief(row)));
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.CREATIVE_CREATE], async (principal) => {
    let body: {
      title?: unknown;
      type?: unknown;
      brief?: unknown;
      priority?: unknown;
      clientId?: unknown;
      projectId?: unknown;
      assigneeId?: unknown;
      dueDate?: unknown;
      revisionLimit?: unknown;
    };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const type = typeof body.type === 'string' ? body.type : null;
    const VALID_TYPES = new Set(['DESIGN', 'VIDEO', 'CONTENT', 'THUMBNAIL', 'COPY', 'SCRIPT', 'AI_CONTENT']);

    if (!title || !type || !VALID_TYPES.has(type)) {
      return errorResponse(400, 'VALIDATION_ERROR', 'title and a valid type are required');
    }

    const created = await prisma.creativeBrief.create({
      data: {
        organizationId: principal.organizationId,
        title,
        type: type as never,
        brief: typeof body.brief === 'string' ? body.brief : null,
        status: 'QUEUED',
        priority: typeof body.priority === 'string' ? (body.priority as never) : 'MEDIUM',
        clientId: typeof body.clientId === 'string' ? body.clientId : null,
        projectId: typeof body.projectId === 'string' ? body.projectId : null,
        assigneeId: typeof body.assigneeId === 'string' ? body.assigneeId : null,
        dueDate:
          typeof body.dueDate === 'string' && !Number.isNaN(Date.parse(body.dueDate))
            ? new Date(body.dueDate)
            : null,
        revisionLimit: typeof body.revisionLimit === 'number' ? body.revisionLimit : 3,
        createdById: principal.userId,
      },
      include: BRIEF_INCLUDE,
    });

    return successResponse(presentBrief(created));
  });
}
