import { db } from "@/lib/db";
import type { ScoreOperator } from "@/generated/prisma/enums";
import { notFound, requireField } from "@/modules/crm/shared";
import { recomputeAllLeadScores } from "./scoring";

export type LeadScoringRuleInput = {
  name: string;
  field: string;
  operator: ScoreOperator;
  value?: string;
  points: number;
  isActive?: boolean;
};

export function listLeadScoringRules(organizationId: string) {
  return db.leadScoringRule.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  });
}

export async function createLeadScoringRule(
  organizationId: string,
  input: LeadScoringRuleInput
) {
  requireField(input.name, "Name");
  requireField(input.field, "Field");
  const rule = await db.leadScoringRule.create({
    data: { organizationId, ...input, isActive: input.isActive ?? true },
  });
  await recomputeAllLeadScores(organizationId);
  return rule;
}

export async function updateLeadScoringRule(
  organizationId: string,
  id: string,
  input: Partial<LeadScoringRuleInput>
) {
  const existing = await db.leadScoringRule.findFirst({ where: { id, organizationId } });
  if (!existing) notFound("Lead scoring rule");
  const rule = await db.leadScoringRule.update({ where: { id }, data: input });
  await recomputeAllLeadScores(organizationId);
  return rule;
}

export async function deleteLeadScoringRule(organizationId: string, id: string) {
  const existing = await db.leadScoringRule.findFirst({ where: { id, organizationId } });
  if (!existing) notFound("Lead scoring rule");
  await db.leadScoringRule.delete({ where: { id } });
  await recomputeAllLeadScores(organizationId);
}
