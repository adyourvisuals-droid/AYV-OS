"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getActiveOrg } from "@/lib/session";
import { toStringOrUndefined } from "@/modules/crm/shared";
import * as contactService from "./service";

function readContactForm(formData: FormData) {
  return {
    firstName: String(formData.get("firstName") ?? "").trim(),
    lastName: toStringOrUndefined(formData.get("lastName")),
    email: toStringOrUndefined(formData.get("email")),
    phone: toStringOrUndefined(formData.get("phone")),
    whatsapp: toStringOrUndefined(formData.get("whatsapp")),
    title: toStringOrUndefined(formData.get("title")),
    companyId: toStringOrUndefined(formData.get("companyId")),
    ownerId: toStringOrUndefined(formData.get("ownerId")),
  };
}

export async function createContactAction(formData: FormData) {
  const { organization } = await getActiveOrg();
  const contact = await contactService.createContact(
    organization.id,
    readContactForm(formData)
  );
  revalidatePath("/crm/contacts");
  redirect(`/crm/contacts/${contact.id}`);
}

export async function updateContactAction(id: string, formData: FormData) {
  const { organization } = await getActiveOrg();
  await contactService.updateContact(organization.id, id, readContactForm(formData));
  revalidatePath("/crm/contacts");
  revalidatePath(`/crm/contacts/${id}`);
  redirect(`/crm/contacts/${id}`);
}

export async function deleteContactAction(id: string) {
  const { organization } = await getActiveOrg();
  await contactService.deleteContact(organization.id, id);
  revalidatePath("/crm/contacts");
  redirect("/crm/contacts");
}
