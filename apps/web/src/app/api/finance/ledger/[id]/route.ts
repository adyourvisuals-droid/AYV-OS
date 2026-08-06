import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';
import { LEDGER_ENTRY_INCLUDE, LEDGER_ENTRY_TYPES, presentLedgerEntry } from '@/lib/server/ledger-present';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.LEDGER_MANAGE], async () => {
    const { id } = await params;

    const entry = await prisma.dailyLedgerEntry.findFirst({ where: { id } });
    if (!entry) return errorResponse(404, 'NOT_FOUND', 'Ledger entry not found');

    let body: { type?: unknown; category?: unknown; amount?: unknown; date?: unknown; note?: unknown };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const data: Record<string, unknown> = {};
    if (typeof body.type === 'string') {
      if (!(LEDGER_ENTRY_TYPES as readonly string[]).includes(body.type)) {
        return errorResponse(400, 'VALIDATION_ERROR', `type must be one of: ${LEDGER_ENTRY_TYPES.join(', ')}`);
      }
      data.type = body.type;
    }
    if (typeof body.category === 'string' && body.category.trim()) data.category = body.category.trim();
    if (body.amount !== undefined) {
      const amount = typeof body.amount === 'number' ? body.amount : Number(body.amount);
      if (!amount || amount <= 0) return errorResponse(400, 'VALIDATION_ERROR', 'amount must be a positive number');
      data.amount = amount;
    }
    if (typeof body.date === 'string' && !Number.isNaN(Date.parse(body.date))) data.date = new Date(body.date);
    if (body.note !== undefined) data.note = typeof body.note === 'string' && body.note ? body.note : null;

    const updated = await prisma.dailyLedgerEntry.update({ where: { id }, data, include: LEDGER_ENTRY_INCLUDE });
    return successResponse(presentLedgerEntry(updated));
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.LEDGER_MANAGE], async () => {
    const { id } = await params;

    const entry = await prisma.dailyLedgerEntry.findFirst({ where: { id } });
    if (!entry) return errorResponse(404, 'NOT_FOUND', 'Ledger entry not found');

    await prisma.dailyLedgerEntry.delete({ where: { id } });
    return successResponse({ id });
  });
}
