"use server";

import { revalidatePath } from "next/cache";

import { getActiveOrg } from "@/lib/session";
import { toStringOrUndefined } from "@/modules/crm/shared";
import * as pipelineService from "./service";

export async function createPipelineStageAction(formData: FormData) {
  const { organization } = await getActiveOrg();
  await pipelineService.createPipelineStage(organization.id, {
    name: String(formData.get("name") ?? "").trim(),
    probability: Number(formData.get("probability") ?? 0),
  });
  revalidatePath("/crm/deals");
  revalidatePath("/crm/automations");
}

export async function updatePipelineStageAction(id: string, formData: FormData) {
  const { organization } = await getActiveOrg();
  await pipelineService.updatePipelineStage(organization.id, id, {
    name: toStringOrUndefined(formData.get("name")),
    probability: formData.get("probability")
      ? Number(formData.get("probability"))
      : undefined,
    isWon: formData.get("isWon") === "on",
    isLost: formData.get("isLost") === "on",
  });
  revalidatePath("/crm/deals");
}

export async function deletePipelineStageAction(id: string) {
  const { organization } = await getActiveOrg();
  await pipelineService.deletePipelineStage(organization.id, id);
  revalidatePath("/crm/deals");
}

export async function reorderPipelineStagesAction(orderedIds: string[]) {
  const { organization } = await getActiveOrg();
  await pipelineService.reorderPipelineStages(organization.id, orderedIds);
  revalidatePath("/crm/deals");
}
