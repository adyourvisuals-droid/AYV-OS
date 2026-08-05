import type { NextRequest } from 'next/server';
import type { Prisma } from '../../../../../generated/prisma';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';
import { ListQuery } from '@/lib/server/list-query';
import {
  computeQuotationTotals,
  parseQuotationItems,
  presentQuotation,
  QUOTATION_INCLUDE,
} from '@/lib/server/quotations-present';
import { withAuth } from '@/lib/server/require-auth';
import { scopeFilter } from '@/lib/server/scope';

export const runtime = 'nodejs';

const SORTABLE_FIELDS = ['createdAt', 'total', 'status', 'validUntil'];

export async function GET(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.QUOTATION_READ], async (principal) => {
    const query = new ListQuery(req.nextUrl.searchParams);
    const status = query.get('status');
    const leadId = query.get('leadId');
    const clientId = query.get('clientId');

    const where: Prisma.QuotationWhereInput = {
      ...(scopeFilter(principal, PERMISSIONS.QUOTATION_READ, { ownerField: 'createdById' }) as Prisma.QuotationWhereInput),
      ...(status ? { status } : {}),
      ...(leadId ? { leadId } : {}),
      ...(clientId ? { clientId } : {}),
      ...(query.search ? { number: { contains: query.search, mode: 'insensitive' } } : {}),
      ...(query.deleted ? { deletedAt: { not: null } } : {}),
    };

    const rows = await prisma.quotation.findMany({
      where,
      include: QUOTATION_INCLUDE,
      orderBy: query.orderBy(SORTABLE_FIELDS, [{ createdAt: 'desc' }]),
      skip: query.skip,
      take: query.limit,
    });

    return successResponse(rows.map((row) => presentQuotation(row)));
  });
}

/** Creates a quotation in DRAFT — nothing is sent to the client until the status endpoint moves it to SENT. */
export async function POST(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.QUOTATION_CREATE], async (principal) => {
    let body: {
      leadId?: unknown;
      clientId?: unknown;
      validUntil?: unknown;
      discount?: unknown;
      taxRate?: unknown;
      terms?: unknown;
      notes?: unknown;
      items?: unknown;
    };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const leadId = typeof body.leadId === 'string' && body.leadId ? body.leadId : null;
    const clientId = typeof body.clientId === 'string' && body.clientId ? body.clientId : null;
    if (!leadId && !clientId) {
      return errorResponse(400, 'VALIDATION_ERROR', 'A quotation needs a leadId or a clientId');
    }

    const items = parseQuotationItems(body.items);
    if (!items) {
      return errorResponse(
        400,
        'VALIDATION_ERROR',
        'items must be a non-empty array of { description, quantity, unitPrice, service? }',
      );
    }

    if (leadId) {
      const lead = await prisma.lead.findFirst({ where: { id: leadId }, select: { id: true } });
      if (!lead) return errorResponse(404, 'NOT_FOUND', 'Lead not found');
    }
    if (clientId) {
      const client = await prisma.client.findFirst({ where: { id: clientId }, select: { id: true } });
      if (!client) return errorResponse(404, 'NOT_FOUND', 'Client not found');
    }

    const discount = typeof body.discount === 'number' && body.discount >= 0 ? body.discount : 0;
    const taxRate = typeof body.taxRate === 'number' && body.taxRate >= 0 ? body.taxRate : 18;
    const totals = computeQuotationTotals(items, discount, taxRate);

    const validUntil =
      typeof body.validUntil === 'string' && !Number.isNaN(Date.parse(body.validUntil))
        ? new Date(body.validUntil)
        : new Date(Date.now() + 14 * 86_400_000);

    const year = new Date().getFullYear();
    const countThisYear = await prisma.quotation.count({ where: { number: { startsWith: `QUO-${year}-` } } });
    const number = `QUO-${year}-${String(countThisYear + 1).padStart(4, '0')}`;

    const created = await prisma.quotation.create({
      data: {
        organizationId: principal.organizationId,
        leadId,
        clientId,
        number,
        status: 'DRAFT',
        validUntil,
        subtotal: totals.subtotal,
        discount: totals.discount,
        taxRate,
        taxAmount: totals.taxAmount,
        total: totals.total,
        terms: typeof body.terms === 'string' ? body.terms : null,
        notes: typeof body.notes === 'string' ? body.notes : null,
        createdById: principal.userId,
        items: {
          create: items.map((item, position) => ({
            service: item.service as never,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: Math.round(item.quantity * item.unitPrice),
            position,
          })),
        },
      },
      include: QUOTATION_INCLUDE,
    });

    return successResponse(presentQuotation(created));
  });
}
