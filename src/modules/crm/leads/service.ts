import { db } from "@/lib/db";
import type { LeadSource, LeadStatus } from "@/generated/prisma/enums";
import { notFound, requireField, ServiceError } from "@/modules/crm/shared";
import { recomputeLeadScore } from "./scoring";
import { runAutomations } from "@/modules/crm/automations/engine";

export type LeadInput = {
  name: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  source?: LeadSource;
  status?: LeadStatus;
  budget?: number;
  notes?: string;
  companyId?: string;
  contactId?: string;
  ownerId?: string;
};

export function listLeads(
  organizationId: string,
  filters?: { status?: LeadStatus; search?: string }
) {
  return db.lead.findMany({
    where: {
      organizationId,
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: "insensitive" } },
              { email: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      company: { select: { id: true, name: true } },
      contact: { select: { id: true, firstName: true, lastName: true } },
      owner: { select: { id: true, name: true } },
    },
    orderBy: [{ score: "desc" }, { createdAt: "desc" }],
  });
}

export async function getLead(organizationId: string, id: string) {
  const lead = await db.lead.findFirst({
    where: { id, organizationId },
    include: {
      company: true,
      contact: true,
      owner: { select: { id: true, name: true, email: true } },
      convertedDeal: { include: { stage: true } },
      activities: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!lead) notFound("Lead");
  return lead;
}

export async function createLead(organizationId: string, input: LeadInput) {
  requireField(input.name, "Name");
  const lead = await db.lead.create({ data: { organizationId, ...input } });
  await recomputeLeadScore(organizationId, lead.id);
  await runAutomations(organizationId, "LEAD_CREATED", "lead", lead.id);
  return getLead(organizationId, lead.id);
}

export async function updateLead(
  organizationId: string,
  id: string,
  input: Partial<LeadInput>
) {
  const existing = await db.lead.findFirst({ where: { id, organizationId } });
  if (!existing) notFound("Lead");
  await db.lead.update({ where: { id }, data: input });
  await recomputeLeadScore(organizationId, id);
  if (input.status && input.status !== existing.status) {
    await runAutomations(organizationId, "LEAD_STATUS_CHANGED", "lead", id);
  }
  return getLead(organizationId, id);
}

export async function deleteLead(organizationId: string, id: string) {
  const existing = await db.lead.findFirst({ where: { id, organizationId } });
  if (!existing) notFound("Lead");
  await db.lead.delete({ where: { id } });
}

/**
 * Converts a qualified lead into a Deal, carrying over company/contact and
 * linking the new deal back to the originating lead.
 */
export async function convertLeadToDeal(
  organizationId: string,
  leadId: string,
  input: { title: string; stageId: string; value?: number }
) {
  const lead = await db.lead.findFirst({ where: { id: leadId, organizationId } });
  if (!lead) notFound("Lead");
  if (lead.convertedDealId) {
    throw new ServiceError("Lead has already been converted", 409);
  }

  const deal = await db.$transaction(async (tx) => {
    const createdDeal = await tx.deal.create({
      data: {
        organizationId,
        title: input.title,
        stageId: input.stageId,
        value: input.value ?? 0,
        contactId: lead.contactId,
        companyId: lead.companyId,
        ownerId: lead.ownerId,
        sourceLeads: { connect: { id: lead.id } },
      },
    });
    await tx.lead.update({
      where: { id: lead.id },
      data: { status: "CONVERTED", convertedDealId: createdDeal.id },
    });
    return createdDeal;
  });

  return deal;
}

export function listLeadOptions(organizationId: string) {
  return db.lead.findMany({
    where: { organizationId, status: { not: "CONVERTED" } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
