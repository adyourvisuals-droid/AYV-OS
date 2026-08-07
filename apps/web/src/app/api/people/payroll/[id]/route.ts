import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';
import { computeNetPay, PAYROLL_STATUSES, presentPayroll } from '@/lib/server/payroll-present';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.PAYROLL_MANAGE], async (principal) => {
    const { id } = await params;

    const payroll = await prisma.payroll.findFirst({ where: { id } });
    if (!payroll) return errorResponse(404, 'NOT_FOUND', 'Payroll record not found');

    let body: {
      basic?: unknown;
      allowances?: unknown;
      deductions?: unknown;
      bonus?: unknown;
      status?: unknown;
    };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const num = (value: unknown, fallback: number): number => {
      if (value === undefined) return fallback;
      const n = typeof value === 'number' ? value : Number(value);
      return Number.isFinite(n) && n >= 0 ? n : fallback;
    };

    const basic = num(body.basic, Number(payroll.basic));
    const allowances = num(body.allowances, Number(payroll.allowances));
    const deductions = num(body.deductions, Number(payroll.deductions));
    const bonus = num(body.bonus, Number(payroll.bonus));

    const data: Record<string, unknown> = {
      basic,
      allowances,
      deductions,
      bonus,
      netPay: computeNetPay(basic, allowances, bonus, deductions),
    };

    if (body.status !== undefined) {
      if (typeof body.status !== 'string' || !(PAYROLL_STATUSES as readonly string[]).includes(body.status)) {
        return errorResponse(400, 'VALIDATION_ERROR', `status must be one of: ${PAYROLL_STATUSES.join(', ')}`);
      }
      data.status = body.status;
      if (body.status === 'APPROVED') data.approvedById = principal.userId;
      if (body.status === 'PAID') data.paidAt = new Date();
    }

    const updated = await prisma.payroll.update({ where: { id }, data });
    const user = await prisma.user.findFirst({
      where: { id: updated.userId },
      select: { id: true, name: true, designation: true },
    });

    return successResponse(presentPayroll(updated, user ?? undefined));
  });
}
