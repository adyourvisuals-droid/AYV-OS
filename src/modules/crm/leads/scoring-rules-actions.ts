"use server";

import { revalidatePath } from "next/cache";

import { getActiveOrg } from "@/lib/session";
import { toStringOrUndefined } from "@/modules/crm/shared";
import type { ScoreOperator } from "@/generated/prisma/enums";
import * as scoringRuleService from "./scoring-rules";

function readForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    field: String(formData.get("field") ?? "").trim(),
    operator: String(formData.get("operator") ?? "IS_SET") as ScoreOperator,
    value: toStringOrUndefined(formData.get("value")),
    points: Number(formData.get("points") ?? 0),
    isActive: formData.get("isActive") === "on",
  };
}

export async function createLeadScoringRuleAction(formData: FormData) {
  const { organization } = await getActiveOrg();
  await scoringRuleService.createLeadScoringRule(organization.id, readForm(formData));
  revalidatePath("/crm/lead-scoring");
  revalidatePath("/crm/leads");
}

export async function updateLeadScoringRuleAction(id: string, formData: FormData) {
  const { organization } = await getActiveOrg();
  await scoringRuleService.updateLeadScoringRule(organization.id, id, readForm(formData));
  revalidatePath("/crm/lead-scoring");
  revalidatePath("/crm/leads");
}

export async function deleteLeadScoringRuleAction(id: string) {
  const { organization } = await getActiveOrg();
  await scoringRuleService.deleteLeadScoringRule(organization.id, id);
  revalidatePath("/crm/lead-scoring");
  revalidatePath("/crm/leads");
}
