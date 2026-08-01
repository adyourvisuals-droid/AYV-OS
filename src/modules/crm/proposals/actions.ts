"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getActiveOrg } from "@/lib/session";
import { toDateOrUndefined, toStringOrUndefined } from "@/modules/crm/shared";
import * as proposalService from "./service";
import type { ProposalItemInput } from "./service";

function readItems(formData: FormData): ProposalItemInput[] {
  const raw = String(formData.get("itemsJson") ?? "[]");
  try {
    const parsed = JSON.parse(raw) as ProposalItemInput[];
    return parsed.filter((item) => item.name?.trim());
  } catch {
    return [];
  }
}

function readProposalForm(formData: FormData) {
  return {
    title: String(formData.get("title") ?? "").trim(),
    dealId: toStringOrUndefined(formData.get("dealId")),
    contactId: toStringOrUndefined(formData.get("contactId")),
    companyId: toStringOrUndefined(formData.get("companyId")),
    summary: toStringOrUndefined(formData.get("summary")),
    currency: toStringOrUndefined(formData.get("currency")),
    validUntil: toDateOrUndefined(formData.get("validUntil")),
    items: readItems(formData),
  };
}

export async function createProposalAction(formData: FormData) {
  const { organization } = await getActiveOrg();
  const proposal = await proposalService.createProposal(
    organization.id,
    readProposalForm(formData)
  );
  revalidatePath("/crm/proposals");
  redirect(`/crm/proposals/${proposal.id}`);
}

export async function updateProposalAction(id: string, formData: FormData) {
  const { organization } = await getActiveOrg();
  await proposalService.updateProposal(organization.id, id, readProposalForm(formData));
  revalidatePath("/crm/proposals");
  revalidatePath(`/crm/proposals/${id}`);
}

export async function setProposalStatusAction(id: string, status: string) {
  const { organization } = await getActiveOrg();
  await proposalService.setProposalStatus(
    organization.id,
    id,
    status as Parameters<typeof proposalService.setProposalStatus>[2]
  );
  revalidatePath("/crm/proposals");
  revalidatePath(`/crm/proposals/${id}`);
}

export async function deleteProposalAction(id: string) {
  const { organization } = await getActiveOrg();
  await proposalService.deleteProposal(organization.id, id);
  revalidatePath("/crm/proposals");
  redirect("/crm/proposals");
}
