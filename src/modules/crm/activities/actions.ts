"use server";

import { revalidatePath } from "next/cache";

import { getActiveOrg } from "@/lib/session";
import type {
  ActivityDirection,
  ActivityStatus,
  ActivityType,
  CallOutcome,
} from "@/generated/prisma/enums";
import {
  toDateOrUndefined,
  toDecimalOrUndefined,
  toStringOrUndefined,
} from "@/modules/crm/shared";
import * as activityService from "./service";

const TYPE_TO_PATH: Record<ActivityType, string> = {
  NOTE: "/crm/notes",
  TASK: "/crm/tasks",
  MEETING: "/crm/meetings",
  CALL: "/crm/calls",
  FOLLOW_UP: "/crm/follow-ups",
  EMAIL: "/crm/emails",
  WHATSAPP: "/crm/whatsapp",
};

function readActivityForm(formData: FormData) {
  return {
    type: String(formData.get("type") ?? "NOTE") as ActivityType,
    subject: String(formData.get("subject") ?? "").trim(),
    body: toStringOrUndefined(formData.get("body")),
    status: (toStringOrUndefined(formData.get("status")) as ActivityStatus) ?? undefined,
    dueDate: toDateOrUndefined(formData.get("dueDate")),
    startTime: toDateOrUndefined(formData.get("startTime")),
    endTime: toDateOrUndefined(formData.get("endTime")),
    location: toStringOrUndefined(formData.get("location")),
    duration: toDecimalOrUndefined(formData.get("duration")),
    outcome: (toStringOrUndefined(formData.get("outcome")) as CallOutcome) ?? undefined,
    direction:
      (toStringOrUndefined(formData.get("direction")) as ActivityDirection) ?? undefined,
    fromAddress: toStringOrUndefined(formData.get("fromAddress")),
    toAddress: toStringOrUndefined(formData.get("toAddress")),
    leadId: toStringOrUndefined(formData.get("leadId")),
    dealId: toStringOrUndefined(formData.get("dealId")),
    contactId: toStringOrUndefined(formData.get("contactId")),
    companyId: toStringOrUndefined(formData.get("companyId")),
    assignedToId: toStringOrUndefined(formData.get("assignedToId")),
  };
}

function revalidateActivityPaths(type: ActivityType, relations: {
  leadId?: string | null;
  dealId?: string | null;
  contactId?: string | null;
  companyId?: string | null;
}) {
  revalidatePath(TYPE_TO_PATH[type]);
  revalidatePath("/crm");
  if (relations.leadId) revalidatePath(`/crm/leads/${relations.leadId}`);
  if (relations.dealId) revalidatePath(`/crm/deals/${relations.dealId}`);
  if (relations.contactId) revalidatePath(`/crm/contacts/${relations.contactId}`);
  if (relations.companyId) revalidatePath(`/crm/companies/${relations.companyId}`);
}

export async function createActivityAction(formData: FormData) {
  const { organization, user } = await getActiveOrg();
  const input = readActivityForm(formData);
  await activityService.createActivity(organization.id, {
    ...input,
    createdById: user.id,
    assignedToId: input.assignedToId ?? user.id,
  });
  revalidateActivityPaths(input.type, input);
}

export async function updateActivityAction(id: string, formData: FormData) {
  const { organization } = await getActiveOrg();
  const input = readActivityForm(formData);
  const activity = await activityService.updateActivity(organization.id, id, input);
  revalidateActivityPaths(activity.type, activity);
}

export async function completeActivityAction(id: string) {
  const { organization } = await getActiveOrg();
  const activity = await activityService.completeActivity(organization.id, id);
  revalidateActivityPaths(activity.type, activity);
}

export async function deleteActivityAction(id: string, type: ActivityType) {
  const { organization } = await getActiveOrg();
  const activity = await activityService.getActivity(organization.id, id).catch(() => null);
  await activityService.deleteActivity(organization.id, id);
  revalidateActivityPaths(type, activity ?? {});
}
