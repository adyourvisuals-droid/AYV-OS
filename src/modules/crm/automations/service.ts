import { db } from "@/lib/db";
import type { AutomationTrigger } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { notFound, requireField } from "@/modules/crm/shared";

export type AutomationCondition = {
  field: string;
  operator: "EQUALS" | "NOT_EQUALS" | "CONTAINS" | "GREATER_THAN" | "LESS_THAN" | "IS_SET";
  value?: string;
};

export type AutomationAction =
  | { type: "ASSIGN_OWNER"; ownerId: string }
  | { type: "CHANGE_STATUS"; status: string }
  | { type: "CREATE_TASK"; subject: string; dueInDays?: number }
  | { type: "CREATE_FOLLOW_UP"; subject: string; dueInDays?: number }
  | { type: "ADJUST_SCORE"; delta: number }
  | { type: "MOVE_STAGE"; stageId: string };

export type AutomationRuleInput = {
  name: string;
  description?: string;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  isActive?: boolean;
};

export function listAutomationRules(organizationId: string) {
  return db.automationRule.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAutomationRule(organizationId: string, id: string) {
  const rule = await db.automationRule.findFirst({
    where: { id, organizationId },
    include: { runLogs: { orderBy: { createdAt: "desc" }, take: 20 } },
  });
  if (!rule) notFound("Automation rule");
  return rule;
}

export function createAutomationRule(
  organizationId: string,
  input: AutomationRuleInput
) {
  requireField(input.name, "Name");
  requireField(input.trigger, "Trigger");
  return db.automationRule.create({
    data: {
      organizationId,
      name: input.name,
      description: input.description,
      trigger: input.trigger,
      conditions: input.conditions as unknown as Prisma.InputJsonValue,
      actions: input.actions as unknown as Prisma.InputJsonValue,
      isActive: input.isActive ?? true,
    },
  });
}

export async function updateAutomationRule(
  organizationId: string,
  id: string,
  input: Partial<AutomationRuleInput>
) {
  const existing = await db.automationRule.findFirst({ where: { id, organizationId } });
  if (!existing) notFound("Automation rule");
  return db.automationRule.update({
    where: { id },
    data: {
      name: input.name,
      description: input.description,
      trigger: input.trigger,
      ...(input.conditions
        ? { conditions: input.conditions as unknown as Prisma.InputJsonValue }
        : {}),
      ...(input.actions
        ? { actions: input.actions as unknown as Prisma.InputJsonValue }
        : {}),
      isActive: input.isActive,
    },
  });
}

export async function toggleAutomationRule(
  organizationId: string,
  id: string,
  isActive: boolean
) {
  const existing = await db.automationRule.findFirst({ where: { id, organizationId } });
  if (!existing) notFound("Automation rule");
  return db.automationRule.update({ where: { id }, data: { isActive } });
}

export async function deleteAutomationRule(organizationId: string, id: string) {
  const existing = await db.automationRule.findFirst({ where: { id, organizationId } });
  if (!existing) notFound("Automation rule");
  await db.automationRule.delete({ where: { id } });
}
