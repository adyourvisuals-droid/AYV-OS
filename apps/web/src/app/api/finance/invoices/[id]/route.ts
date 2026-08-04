import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { INVOICE_INCLUDE, presentInvoice } from '@/lib/server/finance-present';
import { errorResponse, successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.INVOICE_READ], async () => {
    const { id } = await params;

    const invoice = await prisma.invoice.findFirst({
      where: { id },
      include: INVOICE_INCLUDE,
    });
    if (!invoice) return errorResponse(404, 'NOT_FOUND', 'Invoice not found');

    return successResponse(presentInvoice(invoice));
  });
}
