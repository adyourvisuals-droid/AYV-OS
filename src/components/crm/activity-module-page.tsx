import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { getActiveOrg } from "@/lib/session";
import { listActivitiesByType } from "@/modules/crm/activities/service";
import { listLeadOptions } from "@/modules/crm/leads/service";
import { listDealOptions } from "@/modules/crm/deals/service";
import { listContactOptions } from "@/modules/crm/contacts/service";
import { listCompanyOptions } from "@/modules/crm/companies/service";
import { completeActivityAction, deleteActivityAction } from "@/modules/crm/activities/actions";
import type { ActivityType } from "@/generated/prisma/enums";
import { PageHeader } from "@/components/crm/page-header";
import { EmptyState } from "@/components/crm/empty-state";
import { StatusBadge } from "@/components/crm/status-badge";
import { ActivityQuickForm } from "@/components/crm/activity-quick-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const SHOWS_SCHEDULE: ActivityType[] = ["TASK", "MEETING", "FOLLOW_UP"];

export async function ActivityModulePage({
  type,
  title,
  description,
  icon: Icon,
}: {
  type: ActivityType;
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  const { organization } = await getActiveOrg();
  const [activities, leads, deals, contacts, companies] = await Promise.all([
    listActivitiesByType(organization.id, type),
    listLeadOptions(organization.id),
    listDealOptions(organization.id),
    listContactOptions(organization.id),
    listCompanyOptions(organization.id),
  ]);

  const leadOptions = leads.map((l) => ({ id: l.id, label: l.name }));
  const dealOptions = deals.map((d) => ({ id: d.id, label: d.title }));
  const contactOptions = contacts.map((c) => ({
    id: c.id,
    label: `${c.firstName} ${c.lastName ?? ""}`.trim(),
  }));
  const companyOptions = companies.map((c) => ({ id: c.id, label: c.name }));

  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        actions={
          <ActivityQuickForm
            type={type}
            leads={leadOptions}
            deals={dealOptions}
            contacts={contactOptions}
            companies={companyOptions}
          />
        }
      />

      {activities.length === 0 ? (
        <EmptyState icon={Icon} title={`No ${title.toLowerCase()} yet`} />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Related to</TableHead>
                <TableHead>{SHOWS_SCHEDULE.includes(type) ? "Due" : "Date"}</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned to</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activities.map((activity) => {
                const relatedTo =
                  activity.lead?.name ??
                  activity.deal?.title ??
                  (activity.contact
                    ? `${activity.contact.firstName} ${activity.contact.lastName ?? ""}`.trim()
                    : undefined) ??
                  activity.company?.name;
                const relatedHref = activity.lead
                  ? `/crm/leads/${activity.lead.id}`
                  : activity.deal
                    ? `/crm/deals/${activity.deal.id}`
                    : activity.contact
                      ? `/crm/contacts/${activity.contact.id}`
                      : activity.company
                        ? `/crm/companies/${activity.company.id}`
                        : undefined;
                const isTaskLike = type === "TASK" || type === "FOLLOW_UP";
                return (
                  <TableRow key={activity.id}>
                    <TableCell>
                      <span className="font-medium">{activity.subject}</span>
                      {activity.body ? (
                        <div className="line-clamp-1 text-xs text-muted-foreground">
                          {activity.body}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm">
                      {relatedHref ? (
                        <Link href={relatedHref} className="hover:underline">
                          {relatedTo}
                        </Link>
                      ) : (
                        relatedTo ?? "—"
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {activity.dueDate
                        ? new Date(activity.dueDate).toLocaleString()
                        : activity.startTime
                          ? new Date(activity.startTime).toLocaleString()
                          : new Date(activity.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {activity.direction ? (
                        <Badge variant="outline">{activity.direction.toLowerCase()}</Badge>
                      ) : (
                        <StatusBadge status={activity.status} />
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{activity.assignedTo?.name ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {isTaskLike && activity.status !== "DONE" ? (
                          <form action={completeActivityAction.bind(null, activity.id)}>
                            <Button type="submit" size="sm" variant="outline">
                              Done
                            </Button>
                          </form>
                        ) : null}
                        <form action={deleteActivityAction.bind(null, activity.id, type)}>
                          <Button type="submit" size="sm" variant="ghost">
                            Delete
                          </Button>
                        </form>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
