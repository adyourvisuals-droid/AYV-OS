import { db } from "@/lib/db";
import { notFound, requireField } from "@/modules/crm/shared";
import { runAutomations } from "@/modules/crm/automations/engine";

export type DealInput = {
  title: string;
  value?: number;
  currency?: string;
  stageId: string;
  expectedCloseDate?: Date;
  contactId?: string;
  companyId?: string;
  ownerId?: string;
};

export function listDeals(organizationId: string) {
  return db.deal.findMany({
    where: { organizationId },
    include: {
      stage: true,
      contact: { select: { id: true, firstName: true, lastName: true } },
      company: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

/** Deals grouped by stage, in stage order — the shape the Kanban board renders. */
export async function listDealsByStage(organizationId: string) {
  const stages = await db.pipelineStage.findMany({
    where: { organizationId },
    orderBy: { order: "asc" },
    include: {
      deals: {
        where: { status: "OPEN" },
        include: {
          contact: { select: { id: true, firstName: true, lastName: true } },
          company: { select: { id: true, name: true } },
          owner: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  return stages;
}

export async function getDeal(organizationId: string, id: string) {
  const deal = await db.deal.findFirst({
    where: { id, organizationId },
    include: {
      stage: true,
      contact: true,
      company: true,
      owner: { select: { id: true, name: true, email: true } },
      sourceLeads: true,
      activities: { orderBy: { createdAt: "desc" } },
      proposals: { orderBy: { createdAt: "desc" } },
      quotations: { orderBy: { createdAt: "desc" } },
      contracts: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!deal) notFound("Deal");
  return deal;
}

export async function createDeal(organizationId: string, input: DealInput) {
  requireField(input.title, "Title");
  requireField(input.stageId, "Stage");
  const stage = await db.pipelineStage.findFirst({
    where: { id: input.stageId, organizationId },
  });
  if (!stage) notFound("Pipeline stage");
  const deal = await db.deal.create({
    data: { organizationId, ...input, probability: stage.probability },
  });
  await runAutomations(organizationId, "DEAL_CREATED", "deal", deal.id);
  return deal;
}

export async function updateDeal(
  organizationId: string,
  id: string,
  input: Partial<DealInput>
) {
  const existing = await db.deal.findFirst({ where: { id, organizationId } });
  if (!existing) notFound("Deal");
  return db.deal.update({ where: { id }, data: input });
}

/** Moves a deal to a new pipeline stage — the Kanban drag-and-drop action. */
export async function moveDealStage(
  organizationId: string,
  id: string,
  stageId: string
) {
  const [deal, stage] = await Promise.all([
    db.deal.findFirst({ where: { id, organizationId } }),
    db.pipelineStage.findFirst({ where: { id: stageId, organizationId } }),
  ]);
  if (!deal) notFound("Deal");
  if (!stage) notFound("Pipeline stage");

  const updated = await db.deal.update({
    where: { id },
    data: {
      stageId,
      probability: stage.probability,
      status: stage.isWon ? "WON" : stage.isLost ? "LOST" : "OPEN",
      closedAt: stage.isWon || stage.isLost ? new Date() : null,
    },
  });
  if (stageId !== deal.stageId) {
    await runAutomations(organizationId, "DEAL_STAGE_CHANGED", "deal", id);
  }
  return updated;
}

export async function markDealLost(
  organizationId: string,
  id: string,
  lostReason?: string
) {
  const existing = await db.deal.findFirst({ where: { id, organizationId } });
  if (!existing) notFound("Deal");
  return db.deal.update({
    where: { id },
    data: { status: "LOST", closedAt: new Date(), lostReason },
  });
}

export async function deleteDeal(organizationId: string, id: string) {
  const existing = await db.deal.findFirst({ where: { id, organizationId } });
  if (!existing) notFound("Deal");
  await db.deal.delete({ where: { id } });
}

export function listDealOptions(organizationId: string) {
  return db.deal.findMany({
    where: { organizationId, status: "OPEN" },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });
}
