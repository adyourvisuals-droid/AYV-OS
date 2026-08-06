import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';
import { LEDGER_ENTRY_INCLUDE, LEDGER_ENTRY_TYPES, presentLedgerEntry } from '@/lib/server/ledger-present';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.LEDGER_READ], async () => {
    const query = req.nextUrl.searchParams;
    const from = query.get('from');
    const to = query.get('to');
    const limit = Math.min(Number(query.get('limit')) || 200, 500);

    const date: Record<string, Date> = {};
    if (from && !Number.isNaN(Date.parse(from))) date.gte = new Date(from);
    if (to && !Number.isNaN(Date.parse(to))) date.lte = new Date(to);

    const entries = await prisma.dailyLedgerEntry.findMany({
      where: Object.keys(date).length > 0 ? { date } : {},
      include: LEDGER_ENTRY_INCLUDE,
      orderBy: { date: 'desc' },
      take: limit,
    });

    return successResponse(entries.map((entry) => presentLedgerEntry(entry)));
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.LEDGER_MANAGE], async (principal) => {
    let body: { type?: unknown; category?: unknown; amount?: unknown; date?: unknown; note?: unknown };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const type = typeof body.type === 'string' ? body.type : '';
    if (!(LEDGER_ENTRY_TYPES as readonly string[]).includes(type)) {
      return errorResponse(400, 'VALIDATION_ERROR', `type must be one of: ${LEDGER_ENTRY_TYPES.join(', ')}`);
    }

    const category = typeof body.category === 'string' ? body.category.trim() : '';
    if (!category) return errorResponse(400, 'VALIDATION_ERROR', 'category is required');

    const amount = typeof body.amount === 'number' ? body.amount : Number(body.amount);
    if (!amount || amount <= 0) return errorResponse(400, 'VALIDATION_ERROR', 'amount must be a positive number');

    const date =
      typeof body.date === 'string' && !Number.isNaN(Date.parse(body.date)) ? new Date(body.date) : new Date();

    const created = await prisma.dailyLedgerEntry.create({
      data: {
        organizationId: principal.organizationId,
        type: type as never,
        category,
        amount,
        date,
        note: typeof body.note === 'string' && body.note ? body.note : null,
        createdById: principal.userId,
      },
      include: LEDGER_ENTRY_INCLUDE,
    });

    return successResponse(presentLedgerEntry(created));
  });
}
