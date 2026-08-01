"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getActiveOrg } from "@/lib/session";
import { toDateOrUndefined, toStringOrUndefined } from "@/modules/crm/shared";
import * as quotationService from "./service";
import type { QuotationItemInput } from "./service";

function readItems(formData: FormData): QuotationItemInput[] {
  const raw = String(formData.get("itemsJson") ?? "[]");
  try {
    const parsed = JSON.parse(raw) as QuotationItemInput[];
    return parsed.filter((item) => item.name?.trim());
  } catch {
    return [];
  }
}

function readQuotationForm(formData: FormData) {
  return {
    title: String(formData.get("title") ?? "").trim(),
    dealId: toStringOrUndefined(formData.get("dealId")),
    contactId: toStringOrUndefined(formData.get("contactId")),
    companyId: toStringOrUndefined(formData.get("companyId")),
    currency: toStringOrUndefined(formData.get("currency")),
    taxPercent: formData.get("taxPercent") ? Number(formData.get("taxPercent")) : undefined,
    validUntil: toDateOrUndefined(formData.get("validUntil")),
    items: readItems(formData),
  };
}

export async function createQuotationAction(formData: FormData) {
  const { organization } = await getActiveOrg();
  const quotation = await quotationService.createQuotation(
    organization.id,
    readQuotationForm(formData)
  );
  revalidatePath("/crm/quotations");
  redirect(`/crm/quotations/${quotation.id}`);
}

export async function updateQuotationAction(id: string, formData: FormData) {
  const { organization } = await getActiveOrg();
  await quotationService.updateQuotation(
    organization.id,
    id,
    readQuotationForm(formData)
  );
  revalidatePath("/crm/quotations");
  revalidatePath(`/crm/quotations/${id}`);
}

export async function setQuotationStatusAction(id: string, status: string) {
  const { organization } = await getActiveOrg();
  await quotationService.setQuotationStatus(
    organization.id,
    id,
    status as Parameters<typeof quotationService.setQuotationStatus>[2]
  );
  revalidatePath("/crm/quotations");
  revalidatePath(`/crm/quotations/${id}`);
}

export async function deleteQuotationAction(id: string) {
  const { organization } = await getActiveOrg();
  await quotationService.deleteQuotation(organization.id, id);
  revalidatePath("/crm/quotations");
  redirect("/crm/quotations");
}
