import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { INVOICE_INCLUDE, presentInvoice } from '@/lib/server/finance-present';
import { errorResponse, successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

const VALID_METHODS = new Set([
  'BANK_TRANSFER',
  'UPI',
  'CARD',
  'CASH',
  'CHEQUE',
  'RAZORPAY',
  'STRIPE',
  'OTHER',
]);

/**
 * Records a payment against an invoice. `amountPaid` and `status` are
 * derived from the payment history, not set independently — an invoice can
 * never show as PAID while its recorded payments fall short of the total.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.PAYMENT_MANAGE], async (principal) => {
    const { id } = await params;

    let body: { amount?: unknown; method?: unknown; reference?: unknown; note?: unknown };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const amount = typeof body.amount === 'number' && body.amount > 0 ? body.amount : null;
    if (!amount) return errorResponse(400, 'VALIDATION_ERROR', 'amount must be a positive number');

    const method = typeof body.method === 'string' && VALID_METHODS.has(body.method)
      ? body.method
      : 'BANK_TRANSFER';

    const invoice = await prisma.invoice.findFirst({ where: { id } });
    if (!invoice) return errorResponse(404, 'NOT_FOUND', 'Invoice not found');

    const newAmountPaid = Number(invoice.amountPaid) + amount;
    const isFullyPaid = newAmountPaid >= Number(invoice.total);

    await prisma.$transaction([
      prisma.payment.create({
        data: {
          invoiceId: id,
          amount,
          method: method as never,
          reference: typeof body.reference === 'string' ? body.reference : null,
          note: typeof body.note === 'string' ? body.note : null,
          createdById: principal.userId,
        },
      }),
      prisma.invoice.update({
        where: { id },
        data: {
          amountPaid: newAmountPaid,
          ...(isFullyPaid ? { status: 'PAID', paidAt: new Date() } : {}),
        },
      }),
    ]);

    const updated = await prisma.invoice.findFirstOrThrow({ where: { id }, include: INVOICE_INCLUDE });
    return successResponse(presentInvoice(updated));
  });
}
