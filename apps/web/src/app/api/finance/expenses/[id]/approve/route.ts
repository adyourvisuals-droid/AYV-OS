import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { EXPENSE_INCLUDE, presentExpense } from '@/lib/server/finance-present';
import { errorResponse, successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.EXPENSE_APPROVE], async (principal) => {
    const { id } = await params;

    let body: { approved?: unknown };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const approved = body.approved !== false;

    const expense = await prisma.expense.findFirst({ where: { id } });
    if (!expense) return errorResponse(404, 'NOT_FOUND', 'Expense not found');

    const updated = await prisma.expense.update({
      where: { id },
      data: {
        status: approved ? 'APPROVED' : 'REJECTED',
        approvedById: principal.userId,
        approvedAt: new Date(),
      },
      include: EXPENSE_INCLUDE,
    });

    return successResponse(presentExpense(updated));
  });
}
