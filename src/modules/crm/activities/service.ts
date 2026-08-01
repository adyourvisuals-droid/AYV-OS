import { db } from "@/lib/db";
import type {
  ActivityDirection,
  ActivityStatus,
  ActivityType,
  CallOutcome,
} from "@/generated/prisma/enums";
import { notFound, requireField } from "@/modules/crm/shared";

export type ActivityInput = {
  type: ActivityType;
  subject: string;
  body?: string;
  status?: ActivityStatus;
  dueDate?: Date;
  startTime?: Date;
  endTime?: Date;
  location?: string;
  duration?: number;
  outcome?: CallOutcome;
  direction?: ActivityDirection;
  fromAddress?: string;
  toAddress?: string;
  leadId?: string;
  dealId?: string;
  contactId?: string;
  companyId?: string;
  assignedToId?: string;
  createdById?: string;
};

export type ActivityRelationFilter = {
  leadId?: string;
  dealId?: string;
  contactId?: string;
  companyId?: string;
};

const includeRelations = {
  lead: { select: { id: true, name: true } },
  deal: { select: { id: true, title: true } },
  contact: { select: { id: true, firstName: true, lastName: true } },
  company: { select: { id: true, name: true } },
  assignedTo: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
} as const;

/** Lists activities of a given type across the org — the module-level
 *  timeline pages (Tasks, Notes, Meetings, Calls, Follow-ups, Email,
 *  WhatsApp) are all this same query filtered by `type`. */
export function listActivitiesByType(
  organizationId: string,
  type: ActivityType,
  filters?: ActivityRelationFilter & { status?: ActivityStatus }
) {
  return db.activity.findMany({
    where: { organizationId, type, ...filters },
    include: includeRelations,
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
  });
}

/** The full timeline for a single record (lead/deal/contact/company),
 *  across every activity type — used on record detail pages. */
export function listActivitiesForRecord(
  organizationId: string,
  filter: ActivityRelationFilter
) {
  return db.activity.findMany({
    where: { organizationId, ...filter },
    include: includeRelations,
    orderBy: { createdAt: "desc" },
  });
}

export async function getActivity(organizationId: string, id: string) {
  const activity = await db.activity.findFirst({
    where: { id, organizationId },
    include: includeRelations,
  });
  if (!activity) notFound("Activity");
  return activity;
}

export function createActivity(organizationId: string, input: ActivityInput) {
  requireField(input.subject, "Subject");
  requireField(input.type, "Type");
  return db.activity.create({ data: { organizationId, ...input } });
}

export async function updateActivity(
  organizationId: string,
  id: string,
  input: Partial<ActivityInput>
) {
  const existing = await db.activity.findFirst({ where: { id, organizationId } });
  if (!existing) notFound("Activity");
  return db.activity.update({ where: { id }, data: input });
}

export async function completeActivity(organizationId: string, id: string) {
  return updateActivity(organizationId, id, { status: "DONE" });
}

export async function deleteActivity(organizationId: string, id: string) {
  const existing = await db.activity.findFirst({ where: { id, organizationId } });
  if (!existing) notFound("Activity");
  await db.activity.delete({ where: { id } });
}

export function listOverdueTasks(organizationId: string) {
  return db.activity.findMany({
    where: {
      organizationId,
      type: { in: ["TASK", "FOLLOW_UP"] },
      status: { in: ["OPEN", "IN_PROGRESS"] },
      dueDate: { lt: new Date() },
    },
    include: includeRelations,
    orderBy: { dueDate: "asc" },
  });
}

export function listUpcomingActivities(organizationId: string, days = 7) {
  const now = new Date();
  const until = new Date();
  until.setDate(until.getDate() + days);
  return db.activity.findMany({
    where: {
      organizationId,
      type: { in: ["TASK", "MEETING", "FOLLOW_UP"] },
      status: { in: ["OPEN", "IN_PROGRESS"] },
      OR: [
        { dueDate: { gte: now, lte: until } },
        { startTime: { gte: now, lte: until } },
      ],
    },
    include: includeRelations,
    orderBy: { dueDate: "asc" },
    take: 10,
  });
}
