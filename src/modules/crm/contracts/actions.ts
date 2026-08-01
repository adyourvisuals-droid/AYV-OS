"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getActiveOrg } from "@/lib/session";
import {
  toDateOrUndefined,
  toDecimalOrUndefined,
  toStringOrUndefined,
} from "@/modules/crm/shared";
import * as contractService from "./service";

function readContractForm(formData: FormData) {
  return {
    title: String(formData.get("title") ?? "").trim(),
    dealId: toStringOrUndefined(formData.get("dealId")),
    contactId: toStringOrUndefined(formData.get("contactId")),
    companyId: toStringOrUndefined(formData.get("companyId")),
    value: toDecimalOrUndefined(formData.get("value")),
    currency: toStringOrUndefined(formData.get("currency")),
    startDate: toDateOrUndefined(formData.get("startDate")),
    endDate: toDateOrUndefined(formData.get("endDate")),
    content: toStringOrUndefined(formData.get("content")),
  };
}

export async function createContractAction(formData: FormData) {
  const { organization } = await getActiveOrg();
  const contract = await contractService.createContract(
    organization.id,
    readContractForm(formData)
  );
  revalidatePath("/crm/contracts");
  redirect(`/crm/contracts/${contract.id}`);
}

export async function updateContractAction(id: string, formData: FormData) {
  const { organization } = await getActiveOrg();
  await contractService.updateContract(organization.id, id, readContractForm(formData));
  revalidatePath("/crm/contracts");
  revalidatePath(`/crm/contracts/${id}`);
}

export async function setContractStatusAction(id: string, status: string) {
  const { organization } = await getActiveOrg();
  await contractService.setContractStatus(
    organization.id,
    id,
    status as Parameters<typeof contractService.setContractStatus>[2]
  );
  revalidatePath("/crm/contracts");
  revalidatePath(`/crm/contracts/${id}`);
}

export async function deleteContractAction(id: string) {
  const { organization } = await getActiveOrg();
  await contractService.deleteContract(organization.id, id);
  revalidatePath("/crm/contracts");
  redirect("/crm/contracts");
}
