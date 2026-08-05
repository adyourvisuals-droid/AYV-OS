import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';
import {
  computeQuotationTotals,
  parseQuotationItems,
  presentQuotation,
  QUOTATION_INCLUDE,
} from '@/lib/server/quotations-present';
import { withAuth } from '@/lib/server/require-auth';
import { scopeFilter } from '@/lib/server/scope';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.QUOTATION_READ], async (principal) => {
    const { id } = await params;

    const quotation = await prisma.quotation.findFirst({
      where: {
        id,
        ...scopeFilter(principal, PERMISSIONS.QUOTATION_READ, { ownerField: 'createdById' }),
      },
      include: QUOTATION_INCLUDE,
    });
    if (!quotation) return errorResponse(404, 'NOT_FOUND', 'Quotation not found');

    return successResponse(presentQuotation(quotation));
  });
}

/**
 * Edits a quotation. Only while it's still DRAFT — once sent, the document
 * a client received must not silently change under them; a revision means
 * a new quotation instead.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.QUOTATION_UPDATE], async (principal) => {
    const { id } = await params;

    const quotation = await prisma.quotation.findFirst({
      where: {
        id,
        ...scopeFilter(principal, PERMISSIONS.QUOTATION_READ, { ownerField: 'createdById' }),
      },
    });
    if (!quotation) return errorResponse(404, 'NOT_FOUND', 'Quotation not found');
    if (quotation.status !== 'DRAFT') {
      return errorResponse(400, 'VALIDATION_ERROR', 'Only a draft quotation can be edited — send a revision instead');
    }

    let body: {
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

    const newItems = body.items !== undefined ? parseQuotationItems(body.items) : null;
    if (body.items !== undefined && !newItems) {
      return errorResponse(
        400,
        'VALIDATION_ERROR',
        'items must be a non-empty array of { description, quantity, unitPrice, service? }',
      );
    }

    const discount =
      typeof body.discount === 'number' && body.discount >= 0 ? body.discount : Number(quotation.discount);
    const taxRate =
      typeof body.taxRate === 'number' && body.taxRate >= 0 ? body.taxRate : Number(quotation.taxRate);

    // Totals are always recomputed from whichever item set is now current,
    // so discount/taxRate changes stay consistent even when items themselves
    // aren't part of this edit.
    const currentItems =
      newItems ??
      (await prisma.quotationItem.findMany({ where: { quotationId: id } })).map((item) => ({
        service: item.service,
        description: item.description,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
      }));
    const totals = computeQuotationTotals(currentItems, discount, taxRate);

    const data: Record<string, unknown> = { taxRate, ...totals };

    if (body.validUntil !== undefined) {
      if (body.validUntil === null) {
        data.validUntil = null;
      } else if (typeof body.validUntil === 'string' && !Number.isNaN(Date.parse(body.validUntil))) {
        data.validUntil = new Date(body.validUntil);
      } else {
        return errorResponse(400, 'VALIDATION_ERROR', 'validUntil must be a valid date or null');
      }
    }
    if (body.terms !== undefined) data.terms = typeof body.terms === 'string' ? body.terms : null;
    if (body.notes !== undefined) data.notes = typeof body.notes === 'string' ? body.notes : null;

    if (newItems) {
      await prisma.$transaction([
        prisma.quotationItem.deleteMany({ where: { quotationId: id } }),
        prisma.quotation.update({
          where: { id },
          data: {
            ...data,
            items: {
              create: newItems.map((item, position) => ({
                service: item.service as never,
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                amount: Math.round(item.quantity * item.unitPrice),
                position,
              })),
            },
          },
        }),
      ]);
    } else {
      await prisma.quotation.update({ where: { id }, data });
    }

    const updated = await prisma.quotation.findFirstOrThrow({ where: { id }, include: QUOTATION_INCLUDE });
    return successResponse(presentQuotation(updated));
  });
}
