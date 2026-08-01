"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getActiveOrg } from "@/lib/session";
import { toStringOrUndefined } from "@/modules/crm/shared";
import * as automationService from "./service";
import type { AutomationAction, AutomationCondition } from "./service";
import type { AutomationTrigger } from "@/generated/prisma/enums";

function readJsonArray<T>(formData: FormData, field: string): T[] {
  try {
    return JSON.parse(String(formData.get(field) ?? "[]")) as T[];
  } catch {
    return [];
  }
}

function readAutomationForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    description: toStringOrUndefined(formData.get("description")),
    trigger: String(formData.get("trigger") ?? "") as AutomationTrigger,
    conditions: readJsonArray<AutomationCondition>(formData, "conditionsJson"),
    actions: readJsonArray<AutomationAction>(formData, "actionsJson"),
    isActive: formData.get("isActive") === "on",
  };
}

export async function createAutomationRuleAction(formData: FormData) {
  const { organization } = await getActiveOrg();
  await automationService.createAutomationRule(
    organization.id,
    readAutomationForm(formData)
  );
  revalidatePath("/crm/automations");
  redirect("/crm/automations");
}

export async function updateAutomationRuleAction(id: string, formData: FormData) {
  const { organization } = await getActiveOrg();
  await automationService.updateAutomationRule(
    organization.id,
    id,
    readAutomationForm(formData)
  );
  revalidatePath("/crm/automations");
  redirect("/crm/automations");
}

export async function toggleAutomationRuleAction(id: string, isActive: boolean) {
  const { organization } = await getActiveOrg();
  await automationService.toggleAutomationRule(organization.id, id, isActive);
  revalidatePath("/crm/automations");
}

export async function deleteAutomationRuleAction(id: string) {
  const { organization } = await getActiveOrg();
  await automationService.deleteAutomationRule(organization.id, id);
  revalidatePath("/crm/automations");
}
