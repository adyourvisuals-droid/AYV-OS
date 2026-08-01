import { Inject, Injectable } from '@nestjs/common';
import {
  endOfMonth,
  startOfDay,
  startOfMonth,
  subDays,
  subMonths,
  endOfDay,
  format,
} from 'date-fns';

import { LeadStatus, PIPELINE_STAGES, TaskStatus, type AlertSeverity } from '@ayv/types';
import type { AuthPrincipal } from '@/common/decorators';
import { PRISMA, type PrismaService } from '@/infra/prisma/prisma.module';

export type DashboardPeriod = 'week' | 'month' | 'quarter' | 'year';

interface PeriodRange {
  from: Date;
  to: Date;
  previousFrom: Date;
  previousTo: Date;
  label: string;
}

@Injectable()
export class AnalyticsService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaService) {}

  /**
   * The Executive Dashboard payload.
   *
   * Phase 1 computes these live. The `AnalyticsSnapshot` table and its rollup
   * jobs land in Phase 2, at which point the revenue, MRR and trend series
   * read from snapshots instead — the response shape does not change, so the
   * frontend is unaffected by that migration.
   */
  async executive(principal: AuthPrincipal, period: DashboardPeriod = 'month') {
    const range = this.resolveRange(period);

    const [
      revenue,
      previousRevenue,
      expenses,
      pipeline,
      receivables,
      recurring,
      funnel,
      clientHealth,
      productivity,
      tasksDueToday,
      renewals,
      revenueTrend,
    ] = await Promise.all([
      this.sumInvoiceTotals(range.from, range.to),
      this.sumInvoiceTotals(range.previousFrom, range.previousTo),
      this.sumExpenses(range.from, range.to),
      this.pipelineSummary(),
      this.receivablesSummary(),
      this.recurringRevenue(),
      this.funnelSummary(),
      this.clientHealthSummary(),
      this.productivitySummary(range.from, range.to),
      this.tasksDueToday(),
      this.upcomingRenewals(),
      this.revenueTrend(12),
    ]);

    const profit = revenue - expenses;
    const margin = revenue > 0 ? Number(((profit / revenue) * 100).toFixed(1)) : 0;
    const monthlyBurn = await this.averageMonthlyExpenses(3);

    const alerts = await this.buildAlerts({ receivables, clientHealth });

    return {
      period: {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        label: range.label,
      },
      revenue: {
        value: revenue,
        change: this.percentChange(revenue, previousRevenue),
        trend: revenueTrend,
      },
      profit: { value: profit, margin, change: null },
      expenses: {
        value: expenses,
        change: null,
        trend: [],
      },
      cash: {
        // A bank-feed integration lands in Phase 2; until then cash is the
        // collected-minus-spent position rather than a real balance.
        balance: receivables.collected - expenses,
        runwayMonths:
          monthlyBurn > 0
            ? Number(((receivables.collected - expenses) / monthlyBurn).toFixed(1))
            : null,
      },
      pipeline,
      receivables,
      mrr: recurring.mrr,
      arr: recurring.arr,
      funnel: funnel.stages,
      conversionRate: funnel.conversionRate,
      clientHealth,
      productivity,
      tasksDueToday,
      upcomingRenewals: renewals,
      alerts,
      aiInsights: this.deriveInsights({ funnel, clientHealth, receivables, pipeline }),
    };
  }

  /** Sales-specific dashboard: targets, activity and the leaderboard. */
  async sales(principal: AuthPrincipal, period: DashboardPeriod = 'month') {
    const range = this.resolveRange(period);

    const [pipeline, funnel, activities, leaderboard, bySource] = await Promise.all([
      this.pipelineSummary(),
      this.funnelSummary(),
      this.prisma.activity.groupBy({
        by: ['type'],
        where: { occurredAt: { gte: range.from, lte: range.to } },
        _count: { _all: true },
      }),
      this.salesLeaderboard(range.from, range.to),
      this.leadsBySource(),
    ]);

    const countOf = (type: string) =>
      activities.find((row) => row.type === type)?._count._all ?? 0;

    const wonValue = await this.prisma.lead.aggregate({
      where: { status: LeadStatus.WON, stageChangedAt: { gte: range.from, lte: range.to } },
      _sum: { estimatedValue: true },
      _count: { _all: true },
    });

    const achieved = Number(wonValue._sum.estimatedValue ?? 0);

    const target = await this.prisma.kpiTarget.findFirst({
      where: { metric: 'revenue', scope: 'ORG', periodStart: range.from },
      select: { target: true },
    });

    const targetValue = Number(target?.target ?? 0);

    return {
      period: { from: range.from.toISOString(), to: range.to.toISOString(), label: range.label },
      target: targetValue,
      achieved,
      achievementRate:
        targetValue > 0 ? Number(((achieved / targetValue) * 100).toFixed(1)) : null,
      pipelineValue: pipeline.value,
      openDeals: pipeline.deals,
      callsLogged: countOf('CALL'),
      meetingsHeld: countOf('MEETING'),
      followUpsDue: await this.prisma.lead.count({
        where: { nextFollowUpAt: { lte: new Date() }, status: { notIn: ['WON', 'LOST'] } },
      }),
      averageDealSize:
        wonValue._count._all > 0 ? Math.round(achieved / wonValue._count._all) : 0,
      conversionRate: funnel.conversionRate,
      leaderboard,
      bySource,
    };
  }

  // ─── Building blocks ─────────────────────────────────────────────────────

  private async sumInvoiceTotals(from: Date, to: Date): Promise<number> {
    const result = await this.prisma.invoice.aggregate({
      where: {
        issueDate: { gte: from, lte: to },
        status: { notIn: ['DRAFT', 'CANCELLED'] },
      },
      _sum: { total: true },
    });
    return Number(result._sum.total ?? 0);
  }

  private async sumExpenses(from: Date, to: Date): Promise<number> {
    const result = await this.prisma.expense.aggregate({
      where: { incurredAt: { gte: from, lte: to }, status: { in: ['APPROVED', 'REIMBURSED'] } },
      _sum: { amount: true },
    });
    return Number(result._sum.amount ?? 0);
  }

  private async averageMonthlyExpenses(months: number): Promise<number> {
    const from = subMonths(startOfMonth(new Date()), months);
    const total = await this.sumExpenses(from, new Date());
    return months > 0 ? total / months : 0;
  }

  private async pipelineSummary() {
    const result = await this.prisma.lead.aggregate({
      where: { status: { notIn: [LeadStatus.WON, LeadStatus.LOST] } },
      _sum: { estimatedValue: true },
      _count: { _all: true },
    });

    // Weighted forecast: each open deal contributes its value scaled by the
    // model's close probability, which is far more useful to a CEO than the
    // raw pipeline total.
    const openLeads = await this.prisma.lead.findMany({
      where: { status: { notIn: [LeadStatus.WON, LeadStatus.LOST] } },
      select: { estimatedValue: true, closeProbability: true },
    });

    const forecast = openLeads.reduce(
      (sum, lead) => sum + Number(lead.estimatedValue) * Number(lead.closeProbability ?? 0.15),
      0,
    );

    return {
      value: Number(result._sum.estimatedValue ?? 0),
      deals: result._count._all,
      forecast: Math.round(forecast),
    };
  }

  private async receivablesSummary() {
    const [outstanding, overdue, collected] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: { status: { in: ['SENT', 'VIEWED', 'PARTIAL', 'OVERDUE'] } },
        _sum: { total: true, amountPaid: true },
      }),
      this.prisma.invoice.aggregate({
        where: {
          status: { notIn: ['PAID', 'CANCELLED', 'DRAFT', 'REFUNDED'] },
          dueDate: { lt: new Date() },
        },
        _sum: { total: true, amountPaid: true },
        _count: { _all: true },
      }),
      this.prisma.payment.aggregate({ _sum: { amount: true } }),
    ]);

    return {
      total:
        Number(outstanding._sum.total ?? 0) - Number(outstanding._sum.amountPaid ?? 0),
      overdue: Number(overdue._sum.total ?? 0) - Number(overdue._sum.amountPaid ?? 0),
      overdueCount: overdue._count._all,
      collected: Number(collected._sum.amount ?? 0),
    };
  }

  private async recurringRevenue() {
    const result = await this.prisma.client.aggregate({
      where: { status: 'ACTIVE', monthlyRetainer: { not: null } },
      _sum: { monthlyRetainer: true },
    });

    const mrr = Number(result._sum.monthlyRetainer ?? 0);
    return { mrr, arr: mrr * 12 };
  }

  private async funnelSummary() {
    const grouped = await this.prisma.lead.groupBy({
      by: ['status'],
      _count: { _all: true },
      _sum: { estimatedValue: true },
    });

    const stages = PIPELINE_STAGES.map((stage) => {
      const row = grouped.find((entry) => entry.status === stage);
      return {
        stage,
        count: row?._count._all ?? 0,
        value: Number(row?._sum.estimatedValue ?? 0),
      };
    });

    const total = grouped.reduce((sum, row) => sum + row._count._all, 0);
    const won = grouped.find((row) => row.status === LeadStatus.WON)?._count._all ?? 0;

    return {
      stages,
      conversionRate: total > 0 ? Number(((won / total) * 100).toFixed(1)) : 0,
    };
  }

  private async clientHealthSummary() {
    const clients = await this.prisma.client.findMany({
      where: { status: { in: ['ACTIVE', 'ONBOARDING'] } },
      select: { healthScore: true },
    });

    const healthy = clients.filter((client) => client.healthScore >= 60).length;
    const atRisk = clients.filter(
      (client) => client.healthScore >= 40 && client.healthScore < 60,
    ).length;
    const critical = clients.filter((client) => client.healthScore < 40).length;

    return {
      healthy,
      atRisk,
      critical,
      average:
        clients.length > 0
          ? Math.round(
              clients.reduce((sum, client) => sum + client.healthScore, 0) / clients.length,
            )
          : 0,
    };
  }

  private async productivitySummary(from: Date, to: Date) {
    const [completed, timeLogged, activeMembers, overdue] = await Promise.all([
      this.prisma.task.count({
        where: { status: TaskStatus.DONE, completedAt: { gte: from, lte: to } },
      }),
      this.prisma.timeLog.aggregate({
        where: { loggedAt: { gte: from, lte: to } },
        _sum: { minutes: true },
      }),
      this.prisma.user.count({ where: { status: 'ACTIVE', userType: 'EMPLOYEE' } }),
      this.prisma.task.count({
        where: {
          dueDate: { lt: new Date() },
          status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] },
        },
      }),
    ]);

    const workingDays = Math.max(
      1,
      Math.round((to.getTime() - from.getTime()) / 86_400_000) * (6 / 7),
    );

    const capacityMinutes = activeMembers * workingDays * 8 * 60;
    const loggedMinutes = timeLogged._sum.minutes ?? 0;

    return {
      utilisation:
        capacityMinutes > 0
          ? Math.min(100, Math.round((loggedMinutes / capacityMinutes) * 100))
          : 0,
      onTimeRate:
        completed + overdue > 0 ? Math.round((completed / (completed + overdue)) * 100) : 100,
      tasksPerDay: Number((completed / workingDays).toFixed(1)),
      tasksCompleted: completed,
      hoursLogged: Number((loggedMinutes / 60).toFixed(1)),
      overdueTasks: overdue,
    };
  }

  private async tasksDueToday(): Promise<number> {
    return this.prisma.task.count({
      where: {
        dueDate: { gte: startOfDay(new Date()), lte: endOfDay(new Date()) },
        status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] },
      },
    });
  }

  private async upcomingRenewals() {
    const clients = await this.prisma.client.findMany({
      where: {
        status: 'ACTIVE',
        renewalDate: { gte: new Date(), lte: new Date(Date.now() + 60 * 86_400_000) },
      },
      select: { id: true, name: true, renewalDate: true, monthlyRetainer: true },
      orderBy: { renewalDate: 'asc' },
      take: 10,
    });

    return clients.map((client) => ({
      clientId: client.id,
      clientName: client.name,
      date: client.renewalDate!.toISOString(),
      value: Number(client.monthlyRetainer ?? 0) * 12,
    }));
  }

  private async revenueTrend(months: number) {
    const points: { label: string; value: number }[] = [];

    for (let offset = months - 1; offset >= 0; offset -= 1) {
      const monthStart = startOfMonth(subMonths(new Date(), offset));
      const monthEnd = endOfMonth(monthStart);
      points.push({
        label: format(monthStart, 'MMM'),
        value: await this.sumInvoiceTotals(monthStart, monthEnd),
      });
    }

    return points;
  }

  private async salesLeaderboard(from: Date, to: Date) {
    const won = await this.prisma.lead.groupBy({
      by: ['ownerId'],
      where: { status: LeadStatus.WON, stageChangedAt: { gte: from, lte: to } },
      _count: { _all: true },
      _sum: { estimatedValue: true },
    });

    const ownerIds = won.map((row) => row.ownerId).filter((id): id is string => id !== null);
    if (ownerIds.length === 0) return [];

    const users = await this.prisma.user.findMany({
      where: { id: { in: ownerIds } },
      select: { id: true, name: true, avatarUrl: true },
    });

    return won
      .filter((row) => row.ownerId)
      .map((row) => {
        const user = users.find((candidate) => candidate.id === row.ownerId);
        return {
          user: {
            id: row.ownerId!,
            name: user?.name ?? 'Unknown',
            avatarUrl: user?.avatarUrl ?? null,
          },
          won: row._count._all,
          value: Number(row._sum.estimatedValue ?? 0),
        };
      })
      .sort((a, b) => b.value - a.value);
  }

  private async leadsBySource() {
    const grouped = await this.prisma.lead.groupBy({
      by: ['source', 'status'],
      _count: { _all: true },
      _sum: { estimatedValue: true },
    });

    const sources = [...new Set(grouped.map((row) => row.source))];

    return sources.map((source) => {
      const rows = grouped.filter((row) => row.source === source);
      const count = rows.reduce((sum, row) => sum + row._count._all, 0);
      const won =
        rows.find((row) => row.status === LeadStatus.WON)?._count._all ?? 0;

      return {
        source,
        count,
        value: rows.reduce((sum, row) => sum + Number(row._sum.estimatedValue ?? 0), 0),
        conversionRate: count > 0 ? Number(((won / count) * 100).toFixed(1)) : 0,
      };
    });
  }

  // ─── Alerts and insights ─────────────────────────────────────────────────

  private async buildAlerts(context: {
    receivables: { overdue: number; overdueCount: number };
    clientHealth: { critical: number; atRisk: number };
  }) {
    const alerts: {
      id: string;
      severity: AlertSeverity;
      type: string;
      message: string;
    }[] = [];

    if (context.receivables.overdueCount > 0) {
      alerts.push({
        id: 'receivables-overdue',
        severity: context.receivables.overdue > 500_000 ? 'CRITICAL' : 'HIGH',
        type: 'RECEIVABLES',
        message: `₹${context.receivables.overdue.toLocaleString('en-IN')} overdue across ${context.receivables.overdueCount} invoice(s)`,
      });
    }

    if (context.clientHealth.critical > 0) {
      alerts.push({
        id: 'client-health-critical',
        severity: 'CRITICAL',
        type: 'CLIENT_HEALTH',
        message: `${context.clientHealth.critical} client(s) in critical health — churn risk`,
      });
    } else if (context.clientHealth.atRisk > 0) {
      alerts.push({
        id: 'client-health-at-risk',
        severity: 'MEDIUM',
        type: 'CLIENT_HEALTH',
        message: `${context.clientHealth.atRisk} client(s) at risk`,
      });
    }

    const overdueProjects = await this.prisma.project.count({
      where: {
        dueDate: { lt: new Date() },
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
      },
    });

    if (overdueProjects > 0) {
      alerts.push({
        id: 'projects-overdue',
        severity: 'HIGH',
        type: 'DELIVERY',
        message: `${overdueProjects} project(s) past their due date`,
      });
    }

    const staleLeads = await this.prisma.lead.count({
      where: {
        status: { notIn: [LeadStatus.WON, LeadStatus.LOST] },
        OR: [
          { lastActivityAt: { lt: subDays(new Date(), 14) } },
          { lastActivityAt: null, createdAt: { lt: subDays(new Date(), 14) } },
        ],
      },
    });

    if (staleLeads > 0) {
      alerts.push({
        id: 'leads-stale',
        severity: 'MEDIUM',
        type: 'PIPELINE',
        message: `${staleLeads} lead(s) with no contact in 14 days`,
      });
    }

    return alerts;
  }

  /**
   * Heuristic insights.
   *
   * Phase 4 replaces this with the CEO Assistant. The shape is identical, so
   * swapping the source is a one-line change in the controller.
   */
  private deriveInsights(context: {
    funnel: { stages: { stage: string; count: number }[]; conversionRate: number };
    clientHealth: { healthy: number; atRisk: number; critical: number };
    receivables: { overdue: number };
    pipeline: { value: number; forecast: number; deals: number };
  }) {
    const insights: {
      id: string;
      type: 'OPPORTUNITY' | 'RISK' | 'OBSERVATION';
      message: string;
      confidence: number;
    }[] = [];

    const proposalStage = context.funnel.stages.find((stage) => stage.stage === 'PROPOSAL');
    const negotiationStage = context.funnel.stages.find(
      (stage) => stage.stage === 'NEGOTIATION',
    );

    if (proposalStage && negotiationStage && proposalStage.count > negotiationStage.count * 3) {
      insights.push({
        id: 'proposal-bottleneck',
        type: 'RISK',
        message:
          `${proposalStage.count} deals are sitting at proposal but only ${negotiationStage.count} ` +
          'have advanced — proposals are converting poorly or not being followed up',
        confidence: 0.74,
      });
    }

    if (context.pipeline.deals > 0) {
      insights.push({
        id: 'weighted-forecast',
        type: 'OBSERVATION',
        message:
          `Weighted forecast is ₹${context.pipeline.forecast.toLocaleString('en-IN')} from ` +
          `₹${context.pipeline.value.toLocaleString('en-IN')} of open pipeline`,
        confidence: 0.8,
      });
    }

    if (context.clientHealth.healthy > 0 && context.clientHealth.critical === 0) {
      insights.push({
        id: 'upsell-candidates',
        type: 'OPPORTUNITY',
        message: `${context.clientHealth.healthy} healthy client(s) are candidates for upsell and referral`,
        confidence: 0.62,
      });
    }

    if (context.receivables.overdue > 0) {
      insights.push({
        id: 'collections',
        type: 'RISK',
        message:
          `₹${context.receivables.overdue.toLocaleString('en-IN')} is tied up in overdue invoices — ` +
          'collecting this is the fastest available cash improvement',
        confidence: 0.9,
      });
    }

    return insights;
  }

  private resolveRange(period: DashboardPeriod): PeriodRange {
    const now = new Date();

    switch (period) {
      case 'week': {
        const from = startOfDay(subDays(now, 6));
        return {
          from,
          to: now,
          previousFrom: startOfDay(subDays(from, 7)),
          previousTo: from,
          label: 'Last 7 days',
        };
      }
      case 'quarter': {
        const from = startOfMonth(subMonths(now, 2));
        return {
          from,
          to: now,
          previousFrom: startOfMonth(subMonths(from, 3)),
          previousTo: from,
          label: 'Last 3 months',
        };
      }
      case 'year': {
        const from = startOfMonth(subMonths(now, 11));
        return {
          from,
          to: now,
          previousFrom: startOfMonth(subMonths(from, 12)),
          previousTo: from,
          label: 'Last 12 months',
        };
      }
      case 'month':
      default: {
        const from = startOfMonth(now);
        const previousFrom = startOfMonth(subMonths(now, 1));
        return {
          from,
          to: endOfMonth(now),
          previousFrom,
          previousTo: endOfMonth(previousFrom),
          label: format(now, 'MMMM yyyy'),
        };
      }
    }
  }

  private percentChange(current: number, previous: number): number | null {
    if (previous === 0) return current > 0 ? 100 : null;
    return Number((((current - previous) / previous) * 100).toFixed(1));
  }
}
