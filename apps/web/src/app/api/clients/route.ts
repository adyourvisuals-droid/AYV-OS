import type { NextRequest } from 'next/server';
import type { Prisma } from '../../../../generated/prisma';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { CLIENT_INCLUDE, clientVisibilityFilter, presentClient } from '@/lib/server/clients-present';
import { successResponse } from '@/lib/server/http';
import { ListQuery } from '@/lib/server/list-query';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

const SORTABLE_FIELDS = ['createdAt', 'name', 'healthScore', 'renewalDate', 'monthlyRetainer'];

/**
 * List client accounts. Returns the plain array (no pagination meta) —
 * the frontend's clients pages call `api.get`, not `api.getWithMeta`.
 */
export async function GET(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.CLIENT_READ], async (principal) => {
    const query = new ListQuery(req.nextUrl.searchParams);
    const status = query.get('status');
    const industry = query.get('industry');
    const accountManagerId = query.get('accountManagerId');
    const atRisk = query.get('atRisk') === 'true';

    const where: Prisma.ClientWhereInput = {
      ...clientVisibilityFilter(principal),
      ...(status ? { status: status as never } : {}),
      ...(industry ? { industry: industry as never } : {}),
      ...(accountManagerId ? { accountManagerId } : {}),
      ...(atRisk ? { healthScore: { lt: 60 } } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { legalName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.deleted ? { deletedAt: { not: null } } : {}),
    };

    const rows = await prisma.client.findMany({
      where,
      include: CLIENT_INCLUDE,
      orderBy: query.orderBy(SORTABLE_FIELDS, [{ createdAt: 'desc' }]),
      skip: query.skip,
      take: query.limit,
    });

    return successResponse(rows.map((row) => presentClient(row)));
  });
}
