import { db } from "@/lib/db";
import type { AutomationTrigger } from "@/generated/prisma/enums";
import type { AutomationAction, AutomationCondition } from "./service";

type EntityRecord = Record<string, unknown>;

function getFieldValue(entity: EntityRecord, field: string): string | null {
  const value = entity[field];
  if (value === null || value === undefined) return null;
  return String(value);
}

function conditionMatches(entity: EntityRecord, condition: AutomationCondition): boolean {
  const value = getFieldValue(entity, condition.field);
  switch (condition.operator) {
    case "IS_SET":
      return value != null && value !== "";
    case "EQUALS":
      return value === condition.value;
    case "NOT_EQUALS":
      return value !== condition.value;
    case "CONTAINS":
      return (
        !!value &&
        !!condition.value &&
        value.toLowerCase().includes(condition.value.toLowerCase())
      );
    case "GREATER_THAN":
      return value != null && condition.value != null && Number(value) > Number(condition.value);
    case "LESS_THAN":
      return value != null && condition.value != null && Number(value) < Number(condition.value);
    default:
      return false;
  }
}

async function executeAction(
  organizationId: string,
  entityType: "lead" | "deal",
  entityId: string,
  action: AutomationAction
) {
  switch (action.type) {
    case "ASSIGN_OWNER":
      if (entityType === "lead") {
        await db.lead.update({ where: { id: entityId }, data: { ownerId: action.ownerId } });
      } else {
        await db.deal.update({ where: { id: entityId }, data: { ownerId: action.ownerId } });
      }
      return `Assigned owner ${action.ownerId}`;

    case "CHANGE_STATUS":
      if (entityType === "lead") {
        await db.lead.update({
          where: { id: entityId },
          data: { status: action.status as never },
        });
      }
      return `Changed status to ${action.status}`;

    case "MOVE_STAGE":
      if (entityType === "deal") {
        const stage = await db.pipelineStage.findFirst({
          where: { id: action.stageId, organizationId },
        });
        if (stage) {
          await db.deal.update({
            where: { id: entityId },
            data: {
              stageId: stage.id,
              probability: stage.probability,
              status: stage.isWon ? "WON" : stage.isLost ? "LOST" : "OPEN",
            },
          });
        }
      }
      return `Moved to stage ${action.stageId}`;

    case "ADJUST_SCORE":
      if (entityType === "lead") {
        await db.lead.update({
          where: { id: entityId },
          data: { score: { increment: action.delta } },
        });
      }
      return `Adjusted score by ${action.delta}`;

    case "CREATE_TASK":
    case "CREATE_FOLLOW_UP": {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (action.dueInDays ?? 1));
      await db.activity.create({
        data: {
          organizationId,
          type: action.type === "CREATE_TASK" ? "TASK" : "FOLLOW_UP",
          subject: action.subject,
          dueDate,
          ...(entityType === "lead" ? { leadId: entityId } : { dealId: entityId }),
        },
      });
      return `Created ${action.type === "CREATE_TASK" ? "task" : "follow-up"}: ${action.subject}`;
    }

    default:
      return "No-op";
  }
}

/**
 * Evaluates every active AutomationRule matching `trigger` against the
 * given entity's current field values. Rules whose conditions all match
 * have their actions executed in order, and each run is recorded to
 * AutomationRunLog for auditability.
 */
export async function runAutomations(
  organizationId: string,
  trigger: AutomationTrigger,
  entityType: "lead" | "deal",
  entityId: string
) {
  const rules = await db.automationRule.findMany({
    where: { organizationId, trigger, isActive: true },
  });
  if (rules.length === 0) return;

  const entity =
    entityType === "lead"
      ? await db.lead.findUnique({ where: { id: entityId } })
      : await db.deal.findUnique({ where: { id: entityId } });
  if (!entity) return;

  for (const rule of rules) {
    const conditions = (rule.conditions as unknown as AutomationCondition[]) ?? [];
    const actions = (rule.actions as unknown as AutomationAction[]) ?? [];
    const matched = conditions.every((condition) =>
      conditionMatches(entity as unknown as EntityRecord, condition)
    );

    if (!matched) continue;

    const messages: string[] = [];
    for (const action of actions) {
      const message = await executeAction(organizationId, entityType, entityId, action);
      messages.push(message);
    }

    await db.automationRunLog.create({
      data: {
        organizationId,
        ruleId: rule.id,
        entityType,
        entityId,
        result: "MATCHED",
        message: messages.join("; "),
      },
    });
  }
}
