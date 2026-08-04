import type { NextRequest } from 'next/server';
import { endOfMonth, startOfMonth, subMonths } from 'date-fns';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { receivablesSummary, sumExpenses, sumInvoiceTotals } from '@/lib/server/analytics';
import { successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

/**
 * Finance overview: this month's revenue/expenses/profit, receivables, and
 * an expense breakdown by category — the numbers the Finance page's summary
 * cards render. Reuses the same building blocks as the executive dashboard
 * so the two never disagree on what "this month's revenue" means.
 */
export async function GET(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.PNL_READ], async () => {
    const from = startOfMonth(new Date());
    const to = endOfMonth(new Date());
    const previousFrom = startOfMonth(subMonths(new Date(), 1));
    const previousTo = endOfMonth(previousFrom);

    const [revenue, previousRevenue, expenses, receivables, categoryBreakdown, vendorCount] =
      await Promise.all([
        sumInvoiceTotals(from, to),
        sumInvoiceTotals(previousFrom, previousTo),
        sumExpenses(from, to),
        receivablesSummary(),
        prisma.expense.groupBy({
          by: ['category'],
          where: { incurredAt: { gte: from, lte: to }, status: { in: ['APPROVED', 'REIMBURSED'] } },
          _sum: { amount: true },
        }),
        prisma.vendor.count(),
      ]);

    const profit = revenue - expenses;

    return successResponse({
      period: { from: from.toISOString(), to: to.toISOString() },
      revenue: { value: revenue, previous: previousRevenue },
      expenses: { value: expenses },
      profit: {
        value: profit,
        margin: revenue > 0 ? Number(((profit / revenue) * 100).toFixed(1)) : 0,
      },
      receivables,
      expensesByCategory: categoryBreakdown.map((row) => ({
        category: row.category,
        amount: Number(row._sum.amount ?? 0),
      })),
      vendorCount,
    });
  });
}
