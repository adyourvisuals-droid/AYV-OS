import {
  endOfDay,
  endOfMonth,
  format,
  startOfDay,
  startOfMonth,
  subDays,
  subMonths,
} from 'date-fns';

import { LeadStatus, PIPELINE_STAGES, TaskStatus, type AlertSeverity } from '@ayv/types';

import { prisma } from './db';
import { RequestContextStore } from './request-context';

export type DashboardPeriod = 'week' | 'month' | 'quarter' | 'year';

/**
 * The active tenant, for the raw-SQL aggregates below.
 *
 * Prisma's tenant extension cannot see into `$queryRaw`, so any raw query has
 * to filter by organisation itself. Throwing on a missing context is
 * deliberate: the alternative — falling back to an unfiltered query — would
 * turn a plumbing mistake into a cross-tenant data leak.
 */
function requireOrganizationId(): string {
  const organizationId = RequestContextStore.getOrganizationId();
  if (!organizationId) {
    throw new Error('Analytics query ran without a tenant context');
  }
  return organizationId;
}

interface PeriodRange {
  from: Date;
  to: Date;
  previousFrom: Date;
  previousTo: Date;
  label: string;
}

/**
 * Ported from apps/api's AnalyticsService#executive. Phase 1 computes these
 * live; the response shape is unchanged from what the frontend already
 * expects (see apps/web's dashboard page).
 */
export async function executiveDashboard(period: DashboardPeriod = 'month') {
  const range = resolveRange(period);

  // Everything the dashboard needs, issued at once. Nothing here depends on
  // anything else here, so the endpoint costs one round trip's latency rather
  // than the sum of its parts — the alert counts and the burn-rate figure
  // used to run sequentially after this batch had already resolved.
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
    monthlyBurn,
    overdueProjects,
    staleLeads,
  ] = await Promise.all([
    sumInvoiceTotals(range.from, range.to),
    sumInvoiceTotals(range.previousFrom, range.previousTo),
    sumExpenses(range.from, range.to),
    pipelineSummary(),
    receivablesSummary(),
    recurringRevenue(),
    funnelSummary(),
    clientHealthSummary(),
    productivitySummary(range.from, range.to),
    tasksDueTodayCount(),
    upcomingRenewals(),
    revenueTrendSeries(12),
    averageMonthlyExpenses(3),
    overdueProjectCount(),
    staleLeadCount(),
  ]);

  const profit = revenue - expenses;
  const margin = revenue > 0 ? Number(((profit / revenue) * 100).toFixed(1)) : 0;

  const alerts = buildAlerts({ receivables, clientHealth, overdueProjects, staleLeads });

  return {
    period: {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      label: range.label,
    },
    revenue: {
      value: revenue,
      change: percentChange(revenue, previousRevenue),
      trend: revenueTrend,
    },
    profit: { value: profit, margin, change: null },
    expenses: { value: expenses, change: null, trend: [] },
    cash: {
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
    aiInsights: deriveInsights({ funnel, clientHealth, receivables, pipeline }),
  };
}

// ─── Building blocks ─────────────────────────────────────────────────────

export async function sumInvoiceTotals(from: Date, to: Date): Promise<number> {
  const result = await prisma.invoice.aggregate({
    where: { issueDate: { gte: from, lte: to }, status: { notIn: ['DRAFT', 'CANCELLED'] } },
    _sum: { total: true },
  });
  return Number(result._sum.total ?? 0);
}

export async function sumExpenses(from: Date, to: Date): Promise<number> {
  const result = await prisma.expense.aggregate({
    where: { incurredAt: { gte: from, lte: to }, status: { in: ['APPROVED', 'REIMBURSED'] } },
    _sum: { amount: true },
  });
  return Number(result._sum.amount ?? 0);
}

async function averageMonthlyExpenses(months: number): Promise<number> {
  const from = subMonths(startOfMonth(new Date()), months);
  const total = await sumExpenses(from, new Date());
  return months > 0 ? total / months : 0;
}

/**
 * Open pipeline value, deal count, and probability-weighted forecast.
 *
 * Previously two sequential queries, the second of which loaded every open
 * lead into memory purely to multiply two columns together. Postgres does the
 * weighting in the same pass that computes the totals, so this is one round
 * trip and its cost no longer grows with the size of the pipeline.
 */
async function pipelineSummary() {
  const organizationId = requireOrganizationId();

  const [row] = await prisma.$queryRaw<{ value: string; deals: bigint; forecast: string }[]>`
    SELECT COALESCE(SUM("estimatedValue"), 0)                                  AS "value",
           COUNT(*)                                                            AS "deals",
           COALESCE(SUM("estimatedValue" * COALESCE("closeProbability", 0.15)), 0) AS "forecast"
    FROM "Lead"
    WHERE "organizationId" = ${organizationId}
      AND "deletedAt" IS NULL
      AND "status" NOT IN ('WON'::"LeadStatus", 'LOST'::"LeadStatus")
  `;

  return {
    value: Number(row?.value ?? 0),
    deals: Number(row?.deals ?? 0),
    forecast: Math.round(Number(row?.forecast ?? 0)),
  };
}

export async function receivablesSummary() {
  const [outstanding, overdue, collected] = await Promise.all([
    prisma.invoice.aggregate({
      where: { status: { in: ['SENT', 'VIEWED', 'PARTIAL', 'OVERDUE'] } },
      _sum: { total: true, amountPaid: true },
    }),
    prisma.invoice.aggregate({
      where: {
        status: { notIn: ['PAID', 'CANCELLED', 'DRAFT', 'REFUNDED'] },
        dueDate: { lt: new Date() },
      },
      _sum: { total: true, amountPaid: true },
      _count: { _all: true },
    }),
    prisma.payment.aggregate({ _sum: { amount: true } }),
  ]);

  return {
    total: Number(outstanding._sum.total ?? 0) - Number(outstanding._sum.amountPaid ?? 0),
    overdue: Number(overdue._sum.total ?? 0) - Number(overdue._sum.amountPaid ?? 0),
    overdueCount: overdue._count._all,
    collected: Number(collected._sum.amount ?? 0),
  };
}

async function recurringRevenue() {
  const result = await prisma.client.aggregate({
    where: { status: 'ACTIVE', monthlyRetainer: { not: null } },
    _sum: { monthlyRetainer: true },
  });

  const mrr = Number(result._sum.monthlyRetainer ?? 0);
  return { mrr, arr: mrr * 12 };
}

async function funnelSummary() {
  const grouped = await prisma.lead.groupBy({
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

async function clientHealthSummary() {
  const clients = await prisma.client.findMany({
    where: { status: { in: ['ACTIVE', 'ONBOARDING'] } },
    select: { healthScore: true },
  });

  const healthy = clients.filter((client) => client.healthScore >= 60).length;
  const atRisk = clients.filter((client) => client.healthScore >= 40 && client.healthScore < 60).length;
  const critical = clients.filter((client) => client.healthScore < 40).length;

  return {
    healthy,
    atRisk,
    critical,
    average:
      clients.length > 0
        ? Math.round(clients.reduce((sum, client) => sum + client.healthScore, 0) / clients.length)
        : 0,
  };
}

async function productivitySummary(from: Date, to: Date) {
  const [completed, timeLogged, activeMembers, overdue] = await Promise.all([
    prisma.task.count({ where: { status: TaskStatus.DONE, completedAt: { gte: from, lte: to } } }),
    prisma.timeLog.aggregate({ where: { loggedAt: { gte: from, lte: to } }, _sum: { minutes: true } }),
    prisma.user.count({ where: { status: 'ACTIVE', userType: 'EMPLOYEE' } }),
    prisma.task.count({
      where: { dueDate: { lt: new Date() }, status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] } },
    }),
  ]);

  const workingDays = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000) * (6 / 7));

  const capacityMinutes = activeMembers * workingDays * 8 * 60;
  const loggedMinutes = timeLogged._sum.minutes ?? 0;

  return {
    utilisation:
      capacityMinutes > 0 ? Math.min(100, Math.round((loggedMinutes / capacityMinutes) * 100)) : 0,
    onTimeRate: completed + overdue > 0 ? Math.round((completed / (completed + overdue)) * 100) : 100,
    tasksPerDay: Number((completed / workingDays).toFixed(1)),
    tasksCompleted: completed,
    hoursLogged: Number((loggedMinutes / 60).toFixed(1)),
    overdueTasks: overdue,
  };
}

async function tasksDueTodayCount(): Promise<number> {
  return prisma.task.count({
    where: {
      dueDate: { gte: startOfDay(new Date()), lte: endOfDay(new Date()) },
      status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] },
    },
  });
}

async function upcomingRenewals() {
  const clients = await prisma.client.findMany({
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

/**
 * Twelve months of invoiced revenue.
 *
 * This was a loop that awaited one aggregate per month — twelve sequential
 * round trips to render a sparkline, and the single largest contributor to
 * the dashboard's latency. Postgres can bucket by month itself, so it is one
 * query regardless of how many months are asked for.
 *
 * Raw SQL bypasses the Prisma extensions, which is exactly why the tenant and
 * soft-delete predicates are written out explicitly here: `organizationId`
 * comes from the request context the same way the extension would have
 * supplied it, and a missing context is a hard error rather than a silent
 * cross-tenant read.
 */
async function revenueTrendSeries(months: number) {
  const organizationId = requireOrganizationId();

  const earliest = startOfMonth(subMonths(new Date(), months - 1));

  const rows = await prisma.$queryRaw<{ month: Date; total: string }[]>`
    SELECT date_trunc('month', "issueDate") AS "month",
           COALESCE(SUM("total"), 0)        AS "total"
    FROM "Invoice"
    WHERE "organizationId" = ${organizationId}
      AND "deletedAt" IS NULL
      AND "issueDate" >= ${earliest}
      AND "status" NOT IN ('DRAFT'::"InvoiceStatus", 'CANCELLED'::"InvoiceStatus")
    GROUP BY 1
  `;

  const totalByMonth = new Map(
    rows.map((row) => [format(row.month, 'yyyy-MM'), Number(row.total)]),
  );

  // Build every bucket from the calendar rather than from the rows, so months
  // with no invoices render as zero instead of vanishing from the series.
  return Array.from({ length: months }, (_, index) => {
    const monthStart = startOfMonth(subMonths(new Date(), months - 1 - index));
    return {
      label: format(monthStart, 'MMM'),
      value: totalByMonth.get(format(monthStart, 'yyyy-MM')) ?? 0,
    };
  });
}

// ─── Alerts and insights ─────────────────────────────────────────────────

/** Projects past their due date that nobody has closed out. */
function overdueProjectCount(): Promise<number> {
  return prisma.project.count({
    where: { dueDate: { lt: new Date() }, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
  });
}

/** Open leads with no recorded contact in the last fortnight. */
function staleLeadCount(): Promise<number> {
  return prisma.lead.count({
    where: {
      status: { notIn: [LeadStatus.WON, LeadStatus.LOST] },
      OR: [
        { lastActivityAt: { lt: subDays(new Date(), 14) } },
        { lastActivityAt: null, createdAt: { lt: subDays(new Date(), 14) } },
      ],
    },
  });
}

/**
 * Pure: every count it reasons about is fetched in the dashboard's parallel
 * batch and handed in. It used to issue two more queries of its own, after
 * that batch had already resolved.
 */
function buildAlerts(context: {
  receivables: { overdue: number; overdueCount: number };
  clientHealth: { critical: number; atRisk: number };
  overdueProjects: number;
  staleLeads: number;
}) {
  const alerts: { id: string; severity: AlertSeverity; type: string; message: string }[] = [];

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

  const { overdueProjects, staleLeads } = context;

  if (overdueProjects > 0) {
    alerts.push({
      id: 'projects-overdue',
      severity: 'HIGH',
      type: 'DELIVERY',
      message: `${overdueProjects} project(s) past their due date`,
    });
  }

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

function deriveInsights(context: {
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
  const negotiationStage = context.funnel.stages.find((stage) => stage.stage === 'NEGOTIATION');

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

function resolveRange(period: DashboardPeriod): PeriodRange {
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

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}
