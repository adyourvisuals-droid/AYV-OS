import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';
import { computeNetPay, presentPayroll } from '@/lib/server/payroll-present';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

/** Attendance statuses that count toward paid present days, and their day weight. */
const PRESENT_WEIGHT: Record<string, number> = {
  PRESENT: 1,
  LATE: 1,
  WFH: 1,
  HALF_DAY: 0.5,
};

/**
 * Generates DRAFT payroll for a month from each active employee's salary and
 * their present days that month. Idempotent — an employee who already has a
 * row for the period is skipped, so re-running never double-pays or clobbers
 * edits already made to a draft.
 */
export async function POST(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.PAYROLL_MANAGE], async (principal) => {
    let body: { month?: unknown; year?: unknown };
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const now = new Date();
    const month = Number(body.month) || now.getUTCMonth() + 1;
    const year = Number(body.year) || now.getUTCFullYear();
    if (month < 1 || month > 12) return errorResponse(400, 'VALIDATION_ERROR', 'month must be 1–12');

    const [employees, existing, attendance] = await Promise.all([
      prisma.user.findMany({
        where: { status: 'ACTIVE', userType: 'EMPLOYEE' },
        select: { id: true, name: true, designation: true, salary: true },
      }),
      prisma.payroll.findMany({ where: { month, year }, select: { userId: true } }),
      prisma.attendance.findMany({
        where: {
          date: {
            gte: new Date(Date.UTC(year, month - 1, 1)),
            lte: new Date(Date.UTC(year, month, 0)),
          },
        },
        select: { userId: true, status: true },
      }),
    ]);

    const alreadyRun = new Set(existing.map((row) => row.userId));
    const presentByUser = new Map<string, number>();
    for (const record of attendance) {
      const weight = PRESENT_WEIGHT[record.status] ?? 0;
      if (weight > 0) presentByUser.set(record.userId, (presentByUser.get(record.userId) ?? 0) + weight);
    }

    const toCreate = employees.filter((employee) => !alreadyRun.has(employee.id));

    if (toCreate.length > 0) {
      await prisma.payroll.createMany({
        data: toCreate.map((employee) => {
          const basic = employee.salary ? Number(employee.salary) : 0;
          return {
            organizationId: principal.organizationId,
            userId: employee.id,
            month,
            year,
            basic,
            allowances: 0,
            deductions: 0,
            bonus: 0,
            netPay: computeNetPay(basic, 0, 0, 0),
            presentDays: presentByUser.get(employee.id) ?? 0,
            status: 'DRAFT',
          };
        }),
      });
    }

    const rows = await prisma.payroll.findMany({ where: { month, year }, orderBy: { netPay: 'desc' } });
    const userById = new Map(employees.map((employee) => [employee.id, employee]));

    return successResponse({
      created: toCreate.length,
      skipped: alreadyRun.size,
      rows: rows.map((row) => presentPayroll(row, userById.get(row.userId))),
    });
  });
}
