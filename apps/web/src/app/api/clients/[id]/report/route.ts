import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { clientVisibilityFilter, CLIENT_INCLUDE, presentClient } from '@/lib/server/clients-present';
import { monthLabel, monthRange } from '@/lib/server/client-report-present';
import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

/**
 * The monthly client report: everything the agency promised and delivered for
 * one client in one month, aggregated for a printable "here's your month"
 * document — retainer deliverables (committed vs delivered), content shipped,
 * and the financial picture (billed, collected, outstanding).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.CLIENT_READ], async (principal) => {
    const { id } = await params;

    const query = req.nextUrl.searchParams;
    const now = new Date();
    const month = Number(query.get('month')) || now.getUTCMonth() + 1;
    const year = Number(query.get('year')) || now.getUTCFullYear();
    if (month < 1 || month > 12) return errorResponse(400, 'VALIDATION_ERROR', 'month must be 1–12');

    const client = await prisma.client.findFirst({
      where: { id, ...clientVisibilityFilter(principal) },
      include: CLIENT_INCLUDE,
    });
    if (!client) return errorResponse(404, 'NOT_FOUND', 'Client not found');

    const { start, end } = monthRange(month, year);

    const [retainers, posts, invoices, paymentsInMonth] = await Promise.all([
      // Every retainer for this client, with just this month's delivery rows.
      // ENDED retainers still count if they were delivering during the period.
      prisma.retainer.findMany({
        where: { clientId: id },
        include: { deliverables: { where: { month, year } } },
        orderBy: { createdAt: 'asc' },
      }),
      // Content published in the window — proof-of-work the client can see.
      prisma.socialPost.findMany({
        where: { clientId: id, status: 'PUBLISHED', publishedAt: { gte: start, lt: end } },
        orderBy: { publishedAt: 'asc' },
        select: {
          id: true,
          caption: true,
          platforms: true,
          publishedAt: true,
          reach: true,
          engagement: true,
        },
      }),
      // Invoices issued in the window.
      prisma.invoice.findMany({
        where: { clientId: id, issueDate: { gte: start, lt: end } },
        orderBy: { issueDate: 'asc' },
        select: {
          id: true,
          number: true,
          status: true,
          issueDate: true,
          dueDate: true,
          total: true,
          amountPaid: true,
        },
      }),
      // Every payment received in the window — which may settle invoices from
      // earlier months, and that's still real collection this period.
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { paidAt: { gte: start, lt: end }, invoice: { clientId: id } },
      }),
    ]);

    const retainerReport = retainers.map((retainer) => {
      const items = [...retainer.deliverables].sort((a, b) => a.position - b.position);
      const committedTotal = items.reduce((sum, item) => sum + item.committed, 0);
      const deliveredTotal = items.reduce((sum, item) => sum + item.delivered, 0);
      return {
        id: retainer.id,
        title: retainer.title,
        monthlyValue: Number(retainer.monthlyValue),
        currency: retainer.currency,
        status: retainer.status,
        generated: items.length > 0,
        committedTotal,
        deliveredTotal,
        items: items.map((item) => ({
          id: item.id,
          label: item.label,
          committed: item.committed,
          delivered: item.delivered,
        })),
      };
    });

    const invoiceReport = invoices.map((invoice) => {
      const total = Number(invoice.total);
      const amountPaid = Number(invoice.amountPaid);
      return {
        id: invoice.id,
        number: invoice.number,
        status: invoice.status,
        issueDate: invoice.issueDate.toISOString(),
        dueDate: invoice.dueDate.toISOString(),
        total,
        amountPaid,
        balance: Math.max(0, total - amountPaid),
      };
    });

    const committedTotal = retainerReport.reduce((sum, r) => sum + r.committedTotal, 0);
    const deliveredTotal = retainerReport.reduce((sum, r) => sum + r.deliveredTotal, 0);
    const billedTotal = invoiceReport.reduce((sum, i) => sum + i.total, 0);
    const outstandingTotal = invoiceReport.reduce((sum, i) => sum + i.balance, 0);
    const collectedTotal = Number(paymentsInMonth._sum.amount ?? 0);

    const presented = presentClient(client);

    return successResponse({
      client: {
        id: presented.id,
        name: presented.name,
        legalName: presented.legalName,
        logoUrl: presented.logoUrl,
        industry: presented.industry,
        status: presented.status,
        healthScore: presented.healthScore,
        currency: presented.currency,
        accountManager: presented.accountManager,
      },
      period: { month, year, label: monthLabel(month, year) },
      retainers: retainerReport,
      content: {
        publishedCount: posts.length,
        reachTotal: posts.reduce((sum, post) => sum + (post.reach ?? 0), 0),
        engagementTotal: posts.reduce((sum, post) => sum + (post.engagement ?? 0), 0),
        posts: posts.map((post) => ({
          id: post.id,
          caption: post.caption,
          platforms: post.platforms,
          publishedAt: post.publishedAt?.toISOString() ?? null,
          reach: post.reach,
          engagement: post.engagement,
        })),
      },
      finance: {
        invoices: invoiceReport,
        billedTotal,
        collectedTotal,
        outstandingTotal,
      },
      summary: {
        committedTotal,
        deliveredTotal,
        completionRate: committedTotal > 0 ? Math.round((deliveredTotal / committedTotal) * 100) : null,
        postsPublished: posts.length,
        billedTotal,
        collectedTotal,
        outstandingTotal,
      },
    });
  });
}
