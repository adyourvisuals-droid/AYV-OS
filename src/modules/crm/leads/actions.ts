"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getActiveOrg } from "@/lib/session";
import type { LeadSource, LeadStatus } from "@/generated/prisma/enums";
import { toDecimalOrUndefined, toStringOrUndefined } from "@/modules/crm/shared";
import * as leadService from "./service";

function readLeadForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    email: toStringOrUndefined(formData.get("email")),
    phone: toStringOrUndefined(formData.get("phone")),
    whatsapp: toStringOrUndefined(formData.get("whatsapp")),
    source: (toStringOrUndefined(formData.get("source")) as LeadSource) ?? undefined,
    status: (toStringOrUndefined(formData.get("status")) as LeadStatus) ?? undefined,
    budget: toDecimalOrUndefined(formData.get("budget")),
    notes: toStringOrUndefined(formData.get("notes")),
    companyId: toStringOrUndefined(formData.get("companyId")),
    contactId: toStringOrUndefined(formData.get("contactId")),
    ownerId: toStringOrUndefined(formData.get("ownerId")),
  };
}

export async function createLeadAction(formData: FormData) {
  const { organization } = await getActiveOrg();
  const lead = await leadService.createLead(organization.id, readLeadForm(formData));
  revalidatePath("/crm/leads");
  redirect(`/crm/leads/${lead.id}`);
}

export async function updateLeadAction(id: string, formData: FormData) {
  const { organization } = await getActiveOrg();
  await leadService.updateLead(organization.id, id, readLeadForm(formData));
  revalidatePath("/crm/leads");
  revalidatePath(`/crm/leads/${id}`);
  redirect(`/crm/leads/${id}`);
}

export async function deleteLeadAction(id: string) {
  const { organization } = await getActiveOrg();
  await leadService.deleteLead(organization.id, id);
  revalidatePath("/crm/leads");
  redirect("/crm/leads");
}

export async function convertLeadAction(id: string, formData: FormData) {
  const { organization } = await getActiveOrg();
  const deal = await leadService.convertLeadToDeal(organization.id, id, {
    title: String(formData.get("title") ?? "").trim(),
    stageId: String(formData.get("stageId") ?? ""),
    value: toDecimalOrUndefined(formData.get("value")),
  });
  revalidatePath("/crm/leads");
  revalidatePath("/crm/deals");
  redirect(`/crm/deals/${deal.id}`);
}
