import type { NextRequest } from 'next/server';
import type { Prisma } from '../../../../../../generated/prisma';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { clientVisibilityFilter } from '@/lib/server/clients-present';
import { computeClientHealth } from '@/lib/server/client-health';
import { errorResponse, successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

/**
 * Recomputes health from live data and persists both the denormalised score
 * and a snapshot with per-signal attribution. Mirrors ClientsService#computeHealth.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.CLIENT_HEALTH_READ], async (principal) => {
    const { id } = await params;

    const client = await prisma.client.findFirst({
      where: { id, ...clientVisibilityFilter(principal) },
    });
    if (!client) return errorResponse(404, 'NOT_FOUND', 'Client not found');

    const [invoices, projects, tickets, portalUsers] = await Promise.all([
      prisma.invoice.findMany({
        where: { clientId: id },
        select: { status: true, dueDate: true, paidAt: true },
      }),
      prisma.project.findMany({
        where: { clientId: id },
        select: { status: true, dueDate: true, completedAt: true },
      }),
      prisma.ticket.findMany({
        where: { clientId: id, status: { notIn: ['RESOLVED', 'CLOSED'] } },
        select: { createdAt: true },
      }),
      prisma.user.findMany({
        where: { clientId: id },
        select: { lastActiveAt: true },
      }),
    ]);

    const paymentDelays = invoices
      .filter((invoice) => invoice.paidAt)
      .map((invoice) =>
        Math.round((invoice.paidAt!.getTime() - invoice.dueDate.getTime()) / 86_400_000),
      );

    const overdueInvoiceCount = invoices.filter(
      (invoice) =>
        invoice.status !== 'PAID' && invoice.status !== 'CANCELLED' && invoice.dueDate < new Date(),
    ).length;

    const completedProjects = projects.filter((project) => project.completedAt);
    const onTimeProjects = completedProjects.filter(
      (project) => !project.dueDate || project.completedAt! <= project.dueDate,
    );

    const thirtyDaysAgo = Date.now() - 30 * 86_400_000;
    const recentLogins = portalUsers.filter(
      (user) => user.lastActiveAt && user.lastActiveAt.getTime() > thirtyDaysAgo,
    ).length;

    const oldestTicket = tickets.reduce<number>((oldest, ticket) => {
      const age = Math.floor((Date.now() - ticket.createdAt.getTime()) / 86_400_000);
      return Math.max(oldest, age);
    }, 0);

    const result = computeClientHealth({
      paymentDelays,
      overdueInvoiceCount,
      medianResponseHours: null,
      medianApprovalHours: null,
      projectsDelivered: completedProjects.length,
      projectsDeliveredOnTime: onTimeProjects.length,
      satisfactionRatings: [],
      openTicketCount: tickets.length,
      oldestOpenTicketDays: oldestTicket,
      recentLogins,
    });

    const signalScore = (key: string) =>
      result.signals.find((signal) => signal.key === key)?.score ?? 0;

    await prisma.$transaction([
      prisma.client.update({
        where: { id },
        data: { healthScore: result.score, healthUpdatedAt: new Date() },
      }),
      prisma.clientHealthSnapshot.create({
        data: {
          clientId: id,
          score: result.score,
          paymentScore: signalScore('payment'),
          communicationScore: signalScore('communication'),
          approvalScore: signalScore('approval'),
          deliveryScore: signalScore('delivery'),
          satisfactionScore: signalScore('satisfaction'),
          supportScore: signalScore('support'),
          engagementScore: signalScore('engagement'),
          signals: result.signals as unknown as Prisma.InputJsonValue,
        },
      }),
    ]);

    return successResponse(result);
  });
}
