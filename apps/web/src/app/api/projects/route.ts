import type { NextRequest } from 'next/server';
import type { Prisma } from '../../../../generated/prisma';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { successResponse } from '@/lib/server/http';
import { ListQuery } from '@/lib/server/list-query';
import { PROJECT_INCLUDE, presentProject, projectVisibilityFilter } from '@/lib/server/projects-present';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

const SORTABLE_FIELDS = ['createdAt', 'name', 'dueDate', 'progress', 'priority'];

/** List projects. Returns the plain array — the frontend uses `api.get`, not `api.getWithMeta`. */
export async function GET(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.PROJECT_READ], async (principal) => {
    const query = new ListQuery(req.nextUrl.searchParams);
    const status = query.get('status');
    const clientId = query.get('clientId');
    const managerId = query.get('managerId');

    const where: Prisma.ProjectWhereInput = {
      ...projectVisibilityFilter(principal),
      ...(status ? { status: status as never } : {}),
      ...(clientId ? { clientId } : {}),
      ...(managerId ? { managerId } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { code: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.deleted ? { deletedAt: { not: null } } : {}),
    };

    const rows = await prisma.project.findMany({
      where,
      include: PROJECT_INCLUDE,
      orderBy: query.orderBy(SORTABLE_FIELDS, [{ createdAt: 'desc' }]),
      skip: query.skip,
      take: query.limit,
    });

    return successResponse(rows.map((row) => presentProject(row, principal)));
  });
}
