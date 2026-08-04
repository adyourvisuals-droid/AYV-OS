import type { NextRequest } from 'next/server';
import type { Prisma } from '../../../../../generated/prisma';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { computeGst, INVOICE_INCLUDE, presentInvoice, type InvoiceLineInput } from '@/lib/server/finance-present';
import { errorResponse, successResponse } from '@/lib/server/http';
import { ListQuery } from '@/lib/server/list-query';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

const SORTABLE_FIELDS = ['issueDate', 'dueDate', 'total', 'status', 'createdAt'];

export async function GET(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.INVOICE_READ], async () => {
    const query = new ListQuery(req.nextUrl.searchParams);
    const status = query.get('status');
    const clientId = query.get('clientId');

    const where: Prisma.InvoiceWhereInput = {
      ...(status ? { status: status as never } : {}),
      ...(clientId ? { clientId } : {}),
      ...(query.search ? { number: { contains: query.search, mode: 'insensitive' } } : {}),
      ...(query.deleted ? { deletedAt: { not: null } } : {}),
    };

    const rows = await prisma.invoice.findMany({
      where,
      include: INVOICE_INCLUDE,
      orderBy: query.orderBy(SORTABLE_FIELDS, [{ issueDate: 'desc' }]),
      skip: query.skip,
      take: query.limit,
    });

    return successResponse(rows.map((row) => presentInvoice(row)));
  });
}

interface CreateInvoiceBody {
  clientId?: unknown;
  projectId?: unknown;
  dueDate?: unknown;
  notes?: unknown;
  items?: unknown;
}

function parseItems(raw: unknown): InvoiceLineInput[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;

  const items: InvoiceLineInput[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) return null;
    const { description, quantity, unitPrice, taxRate } = entry as Record<string, unknown>;
    if (typeof description !== 'string' || !description.trim()) return null;
    if (typeof quantity !== 'number' || quantity <= 0) return null;
    if (typeof unitPrice !== 'number' || unitPrice < 0) return null;
    const rate = typeof taxRate === 'number' ? taxRate : 18;
    items.push({ description, quantity, unitPrice, taxRate: rate });
  }
  return items;
}

/** Creates an invoice with CGST/SGST-vs-IGST computed from state codes. */
export async function POST(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.INVOICE_CREATE], async (principal) => {
    let body: CreateInvoiceBody;
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const clientId = typeof body.clientId === 'string' ? body.clientId : null;
    if (!clientId) return errorResponse(400, 'VALIDATION_ERROR', 'clientId is required');

    const items = parseItems(body.items);
    if (!items) {
      return errorResponse(
        400,
        'VALIDATION_ERROR',
        'items must be a non-empty array of { description, quantity, unitPrice, taxRate? }',
      );
    }

    const dueDate =
      typeof body.dueDate === 'string' && !Number.isNaN(Date.parse(body.dueDate))
        ? new Date(body.dueDate)
        : new Date(Date.now() + 30 * 86_400_000);

    const [client, organization] = await Promise.all([
      prisma.client.findFirst({ where: { id: clientId }, select: { id: true, stateCode: true } }),
      prisma.organization.findFirst({
        where: { id: principal.organizationId },
        select: { stateCode: true },
      }),
    ]);
    if (!client) return errorResponse(404, 'NOT_FOUND', 'Client not found');

    const sameState = Boolean(
      organization?.stateCode && client.stateCode && organization.stateCode === client.stateCode,
    );
    const gst = computeGst(items, sameState);

    const year = new Date().getFullYear();
    const countThisYear = await prisma.invoice.count({
      where: { number: { startsWith: `INV-${year}-` } },
    });
    const number = `INV-${year}-${String(countThisYear + 1).padStart(4, '0')}`;

    const created = await prisma.invoice.create({
      data: {
        organizationId: principal.organizationId,
        clientId,
        projectId: typeof body.projectId === 'string' ? body.projectId : null,
        number,
        status: 'DRAFT',
        issueDate: new Date(),
        dueDate,
        subtotal: gst.subtotal,
        cgst: gst.cgst,
        sgst: gst.sgst,
        igst: gst.igst,
        taxAmount: gst.taxAmount,
        total: gst.total,
        notes: typeof body.notes === 'string' ? body.notes : null,
        createdById: principal.userId,
        items: {
          create: items.map((item, position) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxRate: item.taxRate,
            amount: Math.round(item.quantity * item.unitPrice),
            position,
          })),
        },
      },
      include: INVOICE_INCLUDE,
    });

    return successResponse(presentInvoice(created));
  });
}
