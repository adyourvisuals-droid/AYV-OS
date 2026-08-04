import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { INVOICE_INCLUDE, presentInvoice } from '@/lib/server/finance-present';
import { errorResponse, successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

const VALID_TRANSITIONS = new Set(['SENT', 'VIEWED', 'CANCELLED']);

/**
 * Manual status transitions that don't involve money changing hands — moving
 * to PAID happens only via recording a payment that covers the balance (see
 * the payments route), so it can't drift from the actual amountPaid.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.INVOICE_UPDATE], async () => {
    const { id } = await params;

    let body: { status?: unknown };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const status = typeof body.status === 'string' ? body.status : null;
    if (!status || !VALID_TRANSITIONS.has(status)) {
      return errorResponse(
        400,
        'VALIDATION_ERROR',
        `status must be one of: ${[...VALID_TRANSITIONS].join(', ')}`,
      );
    }

    const invoice = await prisma.invoice.findFirst({ where: { id } });
    if (!invoice) return errorResponse(404, 'NOT_FOUND', 'Invoice not found');

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        status: status as never,
        ...(status === 'SENT' && !invoice.sentAt ? { sentAt: new Date() } : {}),
        ...(status === 'VIEWED' && !invoice.viewedAt ? { viewedAt: new Date() } : {}),
      },
      include: INVOICE_INCLUDE,
    });

    return successResponse(presentInvoice(updated));
  });
}
