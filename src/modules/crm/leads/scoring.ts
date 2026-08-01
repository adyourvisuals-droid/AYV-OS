import { db } from "@/lib/db";
import type { ScoreOperator } from "@/generated/prisma/enums";

type ScorableLead = {
  source: string;
  status: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  budget: unknown;
  notes: string | null;
};

function getFieldValue(lead: ScorableLead, field: string): string | null {
  switch (field) {
    case "source":
      return lead.source;
    case "status":
      return lead.status;
    case "email":
      return lead.email;
    case "phone":
      return lead.phone;
    case "whatsapp":
      return lead.whatsapp;
    case "budget":
      return lead.budget != null ? String(lead.budget) : null;
    case "notes":
      return lead.notes;
    default:
      return null;
  }
}

function matches(
  value: string | null,
  operator: ScoreOperator,
  target: string | null
): boolean {
  switch (operator) {
    case "IS_SET":
      return value != null && value !== "";
    case "EQUALS":
      return value === target;
    case "NOT_EQUALS":
      return value !== target;
    case "CONTAINS":
      return !!value && !!target && value.toLowerCase().includes(target.toLowerCase());
    case "GREATER_THAN":
      return value != null && target != null && Number(value) > Number(target);
    case "LESS_THAN":
      return value != null && target != null && Number(value) < Number(target);
    default:
      return false;
  }
}

/**
 * Recomputes a lead's score by evaluating every active LeadScoringRule
 * for the organization against the lead's current fields and summing
 * the points of every rule that matches.
 */
export async function recomputeLeadScore(organizationId: string, leadId: string) {
  const [lead, rules] = await Promise.all([
    db.lead.findFirst({ where: { id: leadId, organizationId } }),
    db.leadScoringRule.findMany({
      where: { organizationId, isActive: true },
    }),
  ]);
  if (!lead) return null;

  const score = rules.reduce((total, rule) => {
    const value = getFieldValue(lead, rule.field);
    return matches(value, rule.operator, rule.value) ? total + rule.points : total;
  }, 0);

  return db.lead.update({ where: { id: leadId }, data: { score } });
}

export async function recomputeAllLeadScores(organizationId: string) {
  const leads = await db.lead.findMany({
    where: { organizationId },
    select: { id: true },
  });
  await Promise.all(leads.map((lead) => recomputeLeadScore(organizationId, lead.id)));
}
