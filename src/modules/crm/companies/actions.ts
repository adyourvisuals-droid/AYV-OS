"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getActiveOrg } from "@/lib/session";
import { toStringOrUndefined } from "@/modules/crm/shared";
import * as companyService from "./service";

function readCompanyForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    domain: toStringOrUndefined(formData.get("domain")),
    industry: toStringOrUndefined(formData.get("industry")),
    size: toStringOrUndefined(formData.get("size")),
    website: toStringOrUndefined(formData.get("website")),
    phone: toStringOrUndefined(formData.get("phone")),
    address: toStringOrUndefined(formData.get("address")),
    city: toStringOrUndefined(formData.get("city")),
    country: toStringOrUndefined(formData.get("country")),
    description: toStringOrUndefined(formData.get("description")),
    ownerId: toStringOrUndefined(formData.get("ownerId")),
  };
}

export async function createCompanyAction(formData: FormData) {
  const { organization } = await getActiveOrg();
  const company = await companyService.createCompany(
    organization.id,
    readCompanyForm(formData)
  );
  revalidatePath("/crm/companies");
  redirect(`/crm/companies/${company.id}`);
}

export async function updateCompanyAction(id: string, formData: FormData) {
  const { organization } = await getActiveOrg();
  await companyService.updateCompany(organization.id, id, readCompanyForm(formData));
  revalidatePath("/crm/companies");
  revalidatePath(`/crm/companies/${id}`);
  redirect(`/crm/companies/${id}`);
}

export async function deleteCompanyAction(id: string) {
  const { organization } = await getActiveOrg();
  await companyService.deleteCompany(organization.id, id);
  revalidatePath("/crm/companies");
  redirect("/crm/companies");
}
