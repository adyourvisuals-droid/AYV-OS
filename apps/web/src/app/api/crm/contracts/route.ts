import type { NextRequest } from 'next/server';
import type { Prisma } from '../../../../../generated/prisma';

import { PERMISSIONS } from '@ayv/types';

import { CONTRACT_INCLUDE, presentContract } from '@/lib/server/contracts-present';
import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';
import { ListQuery } from '@/lib/server/list-query';
import { withAuth } from '@/lib/server/require-auth';
import { scopeFilter } from '@/lib/server/scope';

export const runtime = 'nodejs';

const SORTABLE_FIELDS = ['createdAt', 'value', 'status', 'startDate', 'endDate'];

export async function GET(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.CONTRACT_READ], async (principal) => {
    const query = new ListQuery(req.nextUrl.searchParams);
    const status = query.get('status');
    const clientId = query.get('clientId');
    const leadId = query.get('leadId');

    const where: Prisma.ContractWhereInput = {
      ...(scopeFilter(principal, PERMISSIONS.CONTRACT_READ, { ownerField: 'createdById' }) as Prisma.ContractWhereInput),
      ...(status ? { status } : {}),
      ...(clientId ? { clientId } : {}),
      ...(leadId ? { leadId } : {}),
      ...(query.search
        ? { OR: [{ number: { contains: query.search, mode: 'insensitive' } }, { title: { contains: query.search, mode: 'insensitive' } }] }
        : {}),
      ...(query.deleted ? { deletedAt: { not: null } } : {}),
    };

    const rows = await prisma.contract.findMany({
      where,
      include: CONTRACT_INCLUDE,
      orderBy: query.orderBy(SORTABLE_FIELDS, [{ createdAt: 'desc' }]),
      skip: query.skip,
      take: query.limit,
    });

    return successResponse(rows.map((row) => presentContract(row)));
  });
}

/**
 * Creates a contract in DRAFT. Deliberately not open to Sales Executives —
 * CONTRACT_CREATE is only granted to Sales Head and above, unlike
 * QUOTATION_CREATE which every rep holds for their own leads.
 */
export async function POST(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.CONTRACT_CREATE], async (principal) => {
    let body: {
      title?: unknown;
      clientId?: unknown;
      leadId?: unknown;
      value?: unknown;
      currency?: unknown;
      startDate?: unknown;
      endDate?: unknown;
      noticePeriodDays?: unknown;
      terms?: unknown;
    };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) return errorResponse(400, 'VALIDATION_ERROR', 'title is required');

    const clientId = typeof body.clientId === 'string' && body.clientId ? body.clientId : null;
    if (clientId) {
      const client = await prisma.client.findFirst({ where: { id: clientId }, select: { id: true } });
      if (!client) return errorResponse(404, 'NOT_FOUND', 'Client not found');
    }

    const leadId = typeof body.leadId === 'string' && body.leadId ? body.leadId : null;
    if (leadId) {
      const lead = await prisma.lead.findFirst({ where: { id: leadId }, select: { id: true } });
      if (!lead) return errorResponse(404, 'NOT_FOUND', 'Lead not found');
    }

    const value = typeof body.value === 'number' && body.value >= 0 ? body.value : 0;

    const parseDate = (input: unknown): Date | null => {
      if (typeof input !== 'string' || !input) return null;
      const parsed = new Date(input);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const year = new Date().getFullYear();
    const countThisYear = await prisma.contract.count({ where: { number: { startsWith: `CTR-${year}-` } } });
    const number = `CTR-${year}-${String(countThisYear + 1).padStart(4, '0')}`;

    const created = await prisma.contract.create({
      data: {
        organizationId: principal.organizationId,
        number,
        title,
        clientId,
        leadId,
        status: 'DRAFT',
        value,
        currency: typeof body.currency === 'string' && body.currency ? body.currency : 'INR',
        startDate: parseDate(body.startDate),
        endDate: parseDate(body.endDate),
        noticePeriodDays: typeof body.noticePeriodDays === 'number' ? body.noticePeriodDays : null,
        terms: typeof body.terms === 'object' && body.terms !== null ? body.terms : undefined,
        createdById: principal.userId,
      },
      include: CONTRACT_INCLUDE,
    });

    return successResponse(presentContract(created));
  });
}
