import type { NextRequest } from 'next/server';
import type { Prisma } from '../../../../../generated/prisma';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { LEAD_INCLUDE, presentLead } from '@/lib/server/crm-present';
import { paginatedResponse } from '@/lib/server/http';
import { ListQuery, paginationMeta } from '@/lib/server/list-query';
import { withAuth } from '@/lib/server/require-auth';
import { scopeFilter } from '@/lib/server/scope';

export const runtime = 'nodejs';

const SORTABLE_FIELDS = [
  'createdAt',
  'updatedAt',
  'name',
  'estimatedValue',
  'score',
  'stageChangedAt',
  'lastActivityAt',
];

export async function GET(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.LEAD_READ], async (principal) => {
    const query = new ListQuery(req.nextUrl.searchParams);
    const status = query.get('status');
    const temperature = query.get('temperature');
    const source = query.get('source');
    const ownerId = query.get('ownerId');
    const service = query.get('service');

    const where: Prisma.LeadWhereInput = {
      ...scopeFilter(principal, PERMISSIONS.LEAD_READ, { ownerField: 'ownerId' }),
      ...(status ? { status: status as never } : {}),
      ...(temperature ? { temperature: temperature as never } : {}),
      ...(source ? { source: source as never } : {}),
      ...(ownerId ? { ownerId } : {}),
      ...(service ? { services: { has: service as never } } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { contactName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search } },
              { company: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.deleted ? { deletedAt: { not: null } } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: LEAD_INCLUDE,
        orderBy: query.orderBy(SORTABLE_FIELDS, [{ stageChangedAt: 'desc' }]),
        skip: query.skip,
        take: query.limit,
      }),
      prisma.lead.count({ where }),
    ]);

    return paginatedResponse(
      rows.map((row) => presentLead(row)),
      paginationMeta(query.page, query.limit, total),
    );
  });
}
