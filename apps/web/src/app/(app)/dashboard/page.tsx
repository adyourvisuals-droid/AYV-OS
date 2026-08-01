'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Lightbulb,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

import { PERMISSIONS } from '@ayv/types';
import { PageHeader } from '@/components/layout/app-shell';
import { MetricCard } from '@/components/features/metric-card';
import { Badge, Card, CardBody, CardHeader, CardTitle, ErrorState, Progress, Skeleton } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { cn, formatCurrency, formatDate, formatNumber, titleCase } from '@/lib/utils';

interface ExecutiveDashboard {
  period: { from: string; to: string; label: string };
  revenue: { value: number; change: number | null; trend: { label: string; value: number }[] };
  profit: { value: number; margin: number };
  expenses: { value: number };
  cash: { balance: number; runwayMonths: number | null };
  pipeline: { value: number; deals: number; forecast: number };
  receivables: { total: number; overdue: number; overdueCount: number };
  mrr: number;
  arr: number;
  funnel: { stage: string; count: number; value: number }[];
  conversionRate: number;
  clientHealth: { healthy: number; atRisk: number; critical: number; average: number };
  productivity: { utilisation: number; onTimeRate: number; tasksPerDay: number; overdueTasks: number };
  tasksDueToday: number;
  upcomingRenewals: { clientId: string; clientName: string; date: string; value: number }[];
  alerts: { id: string; severity: string; type: string; message: string }[];
  aiInsights: { id: string; type: string; message: string; confidence: number }[];
}

const PERIODS = [
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'quarter', label: 'Quarter' },
  { key: 'year', label: 'Year' },
] as const;

export default function DashboardPage() {
  const { user, can } = useAuth();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['key']>('month');
  const [data, setData] = useState<ExecutiveDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hasExecutiveAccess = can(PERMISSIONS.DASHBOARD_EXECUTIVE);

  const load = useCallback(async () => {
    if (!hasExecutiveAccess) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      setData(await api.get<ExecutiveDashboard>(`/analytics/executive?period=${period}`));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load the dashboard');
    } finally {
      setLoading(false);
    }
  }, [period, hasExecutiveAccess]);

  useEffect(() => {
    void load();
  }, [load]);

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const firstName = user?.name.split(' ')[0] ?? '';

  // Roles without executive visibility get a personal dashboard rather than a
  // permission error — the same route, composed differently.
  if (!hasExecutiveAccess) {
    return <PersonalDashboard greeting={greeting} firstName={firstName} />;
  }

  return (
    <>
      <PageHeader
        title={`${greeting}, ${firstName}`}
        subtitle={
          data ? `${data.period.label} · updated just now` : 'Loading your company overview…'
        }
        actions={
          <div className="flex rounded-md border border-subtle bg-surface p-0.5">
            {PERIODS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setPeriod(option.key)}
                className={cn(
                  'rounded px-3 py-1 text-body-sm font-medium transition-colors',
                  period === option.key
                    ? 'bg-brand-500 text-white'
                    : 'text-secondary hover:text-primary',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="space-y-5 p-6">
        {error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : loading || !data ? (
          <DashboardSkeleton />
        ) : (
          <>
            {/* Hero metrics — the "is the company healthy today" row. */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Revenue"
                value={formatCurrency(data.revenue.value, { compact: true })}
                change={data.revenue.change}
                caption={data.period.label}
                trend={data.revenue.trend}
              />
              <MetricCard
                label="Profit"
                value={formatCurrency(data.profit.value, { compact: true })}
                caption={`${data.profit.margin}% margin`}
                tone={data.profit.value >= 0 ? 'success' : 'danger'}
              />
              <MetricCard
                label="Cash position"
                value={formatCurrency(data.cash.balance, { compact: true })}
                caption={
                  data.cash.runwayMonths !== null
                    ? `${data.cash.runwayMonths} months runway`
                    : 'Runway unavailable'
                }
                tone={
                  data.cash.runwayMonths !== null && data.cash.runwayMonths < 3
                    ? 'warning'
                    : 'neutral'
                }
              />
              <MetricCard
                label="Pipeline"
                value={formatCurrency(data.pipeline.value, { compact: true })}
                caption={`${data.pipeline.deals} open · ${formatCurrency(data.pipeline.forecast, { compact: true })} weighted`}
              />
            </section>

            <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <RevenueTrend data={data} />
              <AiBrief alerts={data.alerts} insights={data.aiInsights} />
            </section>

            <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <SalesFunnel funnel={data.funnel} conversionRate={data.conversionRate} />
              <ClientHealth health={data.clientHealth} />
              <Productivity
                productivity={data.productivity}
                tasksDueToday={data.tasksDueToday}
              />
            </section>

            <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Recurring mrr={data.mrr} arr={data.arr} receivables={data.receivables} />
              <Renewals renewals={data.upcomingRenewals} />
            </section>
          </>
        )}
      </div>
    </>
  );
}

// ─── Widgets ───────────────────────────────────────────────────────────────

function RevenueTrend({ data }: { data: ExecutiveDashboard }) {
  const points = data.revenue.trend;
  const max = Math.max(...points.map((point) => point.value), 1);

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Revenue trend</CardTitle>
        <Badge tone="brand">
          MRR {formatCurrency(data.mrr, { compact: true })}
        </Badge>
      </CardHeader>
      <CardBody>
        <div className="flex h-44 items-end gap-1.5">
          {points.map((point) => (
            <div key={point.label} className="group flex flex-1 flex-col items-center gap-1.5">
              <div className="relative flex w-full flex-1 items-end">
                <div
                  className="w-full rounded-t bg-brand-500/85 transition-all duration-300 ease-smooth group-hover:bg-brand-500"
                  style={{ height: `${Math.max(2, (point.value / max) * 100)}%` }}
                />
                <span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-raised px-1.5 py-0.5 text-caption text-primary opacity-0 shadow-md transition-opacity group-hover:opacity-100">
                  {formatCurrency(point.value, { compact: true })}
                </span>
              </div>
              <span className="text-caption text-tertiary">{point.label}</span>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

function AiBrief({
  alerts,
  insights,
}: {
  alerts: ExecutiveDashboard['alerts'];
  insights: ExecutiveDashboard['aiInsights'];
}) {
  const severityTone = (severity: string) =>
    severity === 'CRITICAL' ? 'danger' : severity === 'HIGH' ? 'warning' : 'info';

  return (
    <Card className="border-ai/20">
      <CardHeader className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-ai" aria-hidden />
        <CardTitle>AI brief</CardTitle>
      </CardHeader>
      <CardBody className="space-y-3">
        {alerts.length === 0 && insights.length === 0 && (
          <p className="text-body-sm text-secondary">
            Nothing needs your attention right now.
          </p>
        )}

        {alerts.map((alert) => (
          <div key={alert.id} className="flex gap-2.5">
            <AlertTriangle
              className={cn(
                'mt-0.5 h-4 w-4 shrink-0',
                alert.severity === 'CRITICAL' ? 'text-danger' : 'text-warning',
              )}
              aria-hidden
            />
            <div className="min-w-0">
              <p className="text-body-sm text-primary">{alert.message}</p>
              <Badge tone={severityTone(alert.severity)} className="mt-1">
                {titleCase(alert.type)}
              </Badge>
            </div>
          </div>
        ))}

        {insights.map((insight) => (
          <div key={insight.id} className="flex gap-2.5">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-ai" aria-hidden />
            <div className="min-w-0">
              <p className="text-body-sm text-primary">{insight.message}</p>
              <p className="mt-0.5 text-caption text-tertiary">
                {Math.round(insight.confidence * 100)}% confidence
              </p>
            </div>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

function SalesFunnel({
  funnel,
  conversionRate,
}: {
  funnel: ExecutiveDashboard['funnel'];
  conversionRate: number;
}) {
  const max = Math.max(...funnel.map((stage) => stage.count), 1);

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Sales funnel</CardTitle>
        <Badge tone={conversionRate >= 10 ? 'success' : 'neutral'}>{conversionRate}% conv.</Badge>
      </CardHeader>
      <CardBody className="space-y-2">
        {funnel.map((stage) => (
          <div key={stage.stage} className="flex items-center gap-3">
            <span className="w-20 shrink-0 truncate text-caption text-secondary">
              {titleCase(stage.stage)}
            </span>
            <div className="h-5 flex-1 overflow-hidden rounded bg-sunken">
              <div
                className="flex h-full items-center justify-end rounded bg-brand-500/80 px-1.5 transition-all duration-300 ease-smooth"
                style={{ width: `${Math.max(6, (stage.count / max) * 100)}%` }}
              >
                <span className="text-[10px] font-semibold text-white">{stage.count}</span>
              </div>
            </div>
            <span className="w-16 shrink-0 text-right text-caption tabular text-tertiary">
              {formatCurrency(stage.value, { compact: true })}
            </span>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

function ClientHealth({ health }: { health: ExecutiveDashboard['clientHealth'] }) {
  const total = health.healthy + health.atRisk + health.critical;

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Client health</CardTitle>
        <Link
          href="/clients/health"
          className="inline-flex items-center gap-1 text-caption text-brand-600 hover:underline"
        >
          View <ArrowRight className="h-3 w-3" aria-hidden />
        </Link>
      </CardHeader>
      <CardBody>
        <div className="flex items-baseline gap-2">
          <span className="metric text-display-sm text-primary">{health.average}</span>
          <span className="text-body-sm text-secondary">average score</span>
        </div>

        <Progress
          value={health.average}
          tone={health.average >= 70 ? 'success' : health.average >= 50 ? 'warning' : 'danger'}
          className="mt-3"
        />

        <div className="mt-4 space-y-1.5">
          {[
            { label: 'Healthy', count: health.healthy, tone: 'success' as const },
            { label: 'At risk', count: health.atRisk, tone: 'warning' as const },
            { label: 'Critical', count: health.critical, tone: 'danger' as const },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between">
              <span className="text-body-sm text-secondary">{row.label}</span>
              <Badge tone={row.count > 0 ? row.tone : 'neutral'}>
                {row.count} of {total}
              </Badge>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

function Productivity({
  productivity,
  tasksDueToday,
}: {
  productivity: ExecutiveDashboard['productivity'];
  tasksDueToday: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Team productivity</CardTitle>
      </CardHeader>
      <CardBody className="space-y-3">
        {[
          { label: 'Utilisation', value: `${productivity.utilisation}%`, bar: productivity.utilisation },
          { label: 'On-time rate', value: `${productivity.onTimeRate}%`, bar: productivity.onTimeRate },
        ].map((row) => (
          <div key={row.label}>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-body-sm text-secondary">{row.label}</span>
              <span className="metric text-body-sm font-medium text-primary">{row.value}</span>
            </div>
            <Progress
              value={row.bar}
              tone={row.bar >= 75 ? 'success' : row.bar >= 50 ? 'warning' : 'danger'}
            />
          </div>
        ))}

        <div className="grid grid-cols-2 gap-3 border-t border-subtle pt-3">
          <div>
            <p className="metric text-heading-md text-primary">{tasksDueToday}</p>
            <p className="text-caption text-tertiary">due today</p>
          </div>
          <div>
            <p
              className={cn(
                'metric text-heading-md',
                productivity.overdueTasks > 0 ? 'text-danger' : 'text-primary',
              )}
            >
              {productivity.overdueTasks}
            </p>
            <p className="text-caption text-tertiary">overdue</p>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function Recurring({
  mrr,
  arr,
  receivables,
}: {
  mrr: number;
  arr: number;
  receivables: ExecutiveDashboard['receivables'];
}) {
  return (
    <Card>
      <CardHeader className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-brand-500" aria-hidden />
        <CardTitle>Recurring revenue &amp; receivables</CardTitle>
      </CardHeader>
      <CardBody className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'MRR', value: formatCurrency(mrr, { compact: true }), tone: 'text-primary' },
          { label: 'ARR', value: formatCurrency(arr, { compact: true }), tone: 'text-primary' },
          {
            label: 'Outstanding',
            value: formatCurrency(receivables.total, { compact: true }),
            tone: 'text-primary',
          },
          {
            label: `Overdue (${receivables.overdueCount})`,
            value: formatCurrency(receivables.overdue, { compact: true }),
            tone: receivables.overdue > 0 ? 'text-danger' : 'text-primary',
          },
        ].map((item) => (
          <div key={item.label}>
            <p className="text-overline uppercase text-tertiary">{item.label}</p>
            <p className={cn('metric mt-1 text-heading-md', item.tone)}>{item.value}</p>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

function Renewals({ renewals }: { renewals: ExecutiveDashboard['upcomingRenewals'] }) {
  return (
    <Card>
      <CardHeader className="flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-brand-500" aria-hidden />
        <CardTitle>Renewals in the next 60 days</CardTitle>
      </CardHeader>
      <CardBody>
        {renewals.length === 0 ? (
          <p className="text-body-sm text-secondary">No renewals due in the next 60 days.</p>
        ) : (
          <ul className="divide-y divide-subtle">
            {renewals.map((renewal) => (
              <li key={renewal.clientId} className="flex items-center justify-between py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-body-sm font-medium text-primary">
                    {renewal.clientName}
                  </p>
                  <p className="text-caption text-tertiary">{formatDate(renewal.date, 'long')}</p>
                </div>
                <span className="metric shrink-0 text-body-sm font-medium text-primary">
                  {formatCurrency(renewal.value, { compact: true })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-32" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-64 lg:col-span-2" />
        <Skeleton className="h-64" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-56" />
        ))}
      </div>
    </div>
  );
}

/** What a Designer, Developer or Intern sees on the same route. */
function PersonalDashboard({ greeting, firstName }: { greeting: string; firstName: string }) {
  const [tasks, setTasks] = useState<
    { id: string; title: string; status: string; priority: string; dueDate: string | null; isOverdue: boolean; projectName: string | null }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setTasks(await api.get('/tasks/my'));
      } catch {
        setTasks([]);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const overdue = tasks.filter((task) => task.isOverdue).length;

  return (
    <>
      <PageHeader
        title={`${greeting}, ${firstName}`}
        subtitle="Here is your work, ordered by urgency."
      />
      <div className="space-y-5 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MetricCard label="Open tasks" value={formatNumber(tasks.length)} />
          <MetricCard
            label="Overdue"
            value={formatNumber(overdue)}
            tone={overdue > 0 ? 'danger' : 'success'}
          />
          <MetricCard
            label="Due today"
            value={formatNumber(
              tasks.filter(
                (task) =>
                  task.dueDate &&
                  new Date(task.dueDate).toDateString() === new Date().toDateString(),
              ).length,
            )}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>My tasks</CardTitle>
          </CardHeader>
          <CardBody>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-12" />
                ))}
              </div>
            ) : tasks.length === 0 ? (
              <p className="py-8 text-center text-body-sm text-secondary">
                Nothing assigned to you right now.
              </p>
            ) : (
              <ul className="divide-y divide-subtle">
                {tasks.map((task) => (
                  <li key={task.id} className="flex items-center gap-3 py-3">
                    <span
                      className={cn(
                        'h-2 w-2 shrink-0 rounded-full',
                        task.priority === 'URGENT' || task.priority === 'HIGH'
                          ? 'bg-danger'
                          : task.priority === 'MEDIUM'
                            ? 'bg-warning'
                            : 'bg-tertiary',
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body-sm font-medium text-primary">{task.title}</p>
                      <p className="truncate text-caption text-tertiary">
                        {task.projectName ?? 'No project'}
                      </p>
                    </div>
                    <Badge tone={task.isOverdue ? 'danger' : 'neutral'}>
                      {task.dueDate ? formatDate(task.dueDate) : 'No date'}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
