import Link from "next/link";
import { DollarSign, Target, TrendingUp, AlertCircle } from "lucide-react";

import { getActiveOrg } from "@/lib/session";
import { getDashboardMetrics } from "@/modules/crm/dashboard/service";
import { PageHeader } from "@/components/crm/page-header";
import { StatusBadge } from "@/components/crm/status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils-shared";

export default async function CrmDashboardPage() {
  const { organization } = await getActiveOrg();
  const metrics = await getDashboardMetrics(organization.id);

  const maxStageValue = Math.max(
    1,
    ...metrics.dealsByStage.filter((s) => !s.isWon && !s.isLost).map((s) => s.value)
  );

  return (
    <div>
      <PageHeader
        title="Sales Dashboard"
        description={`Overview for ${organization.name}`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={DollarSign}
          label="Open Pipeline"
          value={formatCurrency(metrics.openPipelineValue)}
          sub={`${metrics.openDealsCount} open deals`}
        />
        <StatCard
          icon={TrendingUp}
          label="Won This Month"
          value={formatCurrency(metrics.wonValueThisMonth)}
          sub={`${metrics.wonDealsThisMonthCount} deals closed`}
        />
        <StatCard
          icon={Target}
          label="Total Leads"
          value={String(metrics.totalLeads)}
          sub={`${metrics.leadsByStatus.find((s) => s.status === "NEW")?.count ?? 0} new`}
        />
        <StatCard
          icon={AlertCircle}
          label="Overdue Tasks"
          value={String(metrics.overdueTasksCount)}
          sub="tasks & follow-ups"
          tone={metrics.overdueTasksCount > 0 ? "danger" : "default"}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Pipeline by stage</CardTitle>
            <CardDescription>Open deal value across your pipeline</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {metrics.dealsByStage
              .filter((stage) => !stage.isWon && !stage.isLost)
              .map((stage) => (
                <div key={stage.id} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{stage.name}</span>
                    <span className="text-muted-foreground">
                      {stage.count} · {formatCurrency(stage.value)}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{
                        width: `${Math.max(4, (stage.value / maxStageValue) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            {metrics.dealsByStage.every((s) => s.isWon || s.isLost) ? (
              <p className="text-sm text-muted-foreground">No open pipeline stages yet.</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top scored leads</CardTitle>
            <CardDescription>Highest lead-scoring prospects</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {metrics.topLeads.length === 0 ? (
              <p className="text-sm text-muted-foreground">No leads yet.</p>
            ) : null}
            {metrics.topLeads.map((lead) => (
              <Link
                key={lead.id}
                href={`/crm/leads/${lead.id}`}
                className="flex items-center justify-between rounded-md p-1.5 text-sm hover:bg-muted"
              >
                <span className="flex items-center gap-2">
                  <span className="font-medium">{lead.name}</span>
                  <StatusBadge status={lead.status} />
                </span>
                <Badge variant="secondary">{lead.score} pts</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>Latest notes, tasks, calls and messages</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col divide-y">
          {metrics.recentActivities.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">No activity recorded yet.</p>
          ) : null}
          {metrics.recentActivities.map((activity) => {
            const relatedTo =
              activity.lead?.name ??
              activity.deal?.title ??
              (activity.contact
                ? `${activity.contact.firstName} ${activity.contact.lastName ?? ""}`.trim()
                : undefined) ??
              activity.company?.name;
            return (
              <div key={activity.id} className="flex items-center justify-between py-2.5 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="uppercase">
                    {activity.type.replace("_", " ")}
                  </Badge>
                  <span className="font-medium">{activity.subject}</span>
                  {relatedTo ? (
                    <span className="text-muted-foreground">· {relatedTo}</span>
                  ) : null}
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(activity.createdAt).toLocaleDateString()}
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone = "default",
}: {
  icon: typeof DollarSign;
  label: string;
  value: string;
  sub: string;
  tone?: "default" | "danger";
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between p-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
          <p
            className={
              tone === "danger"
                ? "mt-1 flex items-center gap-1 text-xs text-destructive"
                : "mt-1 flex items-center gap-1 text-xs text-muted-foreground"
            }
          >
            {sub}
          </p>
        </div>
        <div className="rounded-md bg-primary/10 p-2 text-primary">
          <Icon className="size-4" />
        </div>
      </CardContent>
    </Card>
  );
}
