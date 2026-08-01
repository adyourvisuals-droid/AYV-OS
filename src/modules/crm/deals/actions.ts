"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getActiveOrg } from "@/lib/session";
import {
  toDateOrUndefined,
  toDecimalOrUndefined,
  toStringOrUndefined,
} from "@/modules/crm/shared";
import * as dealService from "./service";

function readDealForm(formData: FormData) {
  return {
    title: String(formData.get("title") ?? "").trim(),
    value: toDecimalOrUndefined(formData.get("value")),
    currency: toStringOrUndefined(formData.get("currency")),
    stageId: String(formData.get("stageId") ?? ""),
    expectedCloseDate: toDateOrUndefined(formData.get("expectedCloseDate")),
    contactId: toStringOrUndefined(formData.get("contactId")),
    companyId: toStringOrUndefined(formData.get("companyId")),
    ownerId: toStringOrUndefined(formData.get("ownerId")),
  };
}

export async function createDealAction(formData: FormData) {
  const { organization } = await getActiveOrg();
  const deal = await dealService.createDeal(organization.id, readDealForm(formData));
  revalidatePath("/crm/deals");
  redirect(`/crm/deals/${deal.id}`);
}

export async function updateDealAction(id: string, formData: FormData) {
  const { organization } = await getActiveOrg();
  await dealService.updateDeal(organization.id, id, readDealForm(formData));
  revalidatePath("/crm/deals");
  revalidatePath(`/crm/deals/${id}`);
  redirect(`/crm/deals/${id}`);
}

export async function moveDealStageAction(id: string, stageId: string) {
  const { organization } = await getActiveOrg();
  await dealService.moveDealStage(organization.id, id, stageId);
  revalidatePath("/crm/deals");
  revalidatePath(`/crm/deals/${id}`);
}

export async function markDealLostAction(id: string, formData: FormData) {
  const { organization } = await getActiveOrg();
  await dealService.markDealLost(
    organization.id,
    id,
    toStringOrUndefined(formData.get("lostReason"))
  );
  revalidatePath("/crm/deals");
  revalidatePath(`/crm/deals/${id}`);
}

export async function deleteDealAction(id: string) {
  const { organization } = await getActiveOrg();
  await dealService.deleteDeal(organization.id, id);
  revalidatePath("/crm/deals");
  redirect("/crm/deals");
}
