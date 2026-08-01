import { db } from "@/lib/db";
import { notFound, requireField } from "@/modules/crm/shared";

export type ProposalItemInput = {
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
};

export type ProposalInput = {
  title: string;
  dealId?: string;
  contactId?: string;
  companyId?: string;
  summary?: string;
  currency?: string;
  validUntil?: Date;
  items: ProposalItemInput[];
};

function computeTotal(items: ProposalItemInput[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

async function nextDocumentNumber(organizationId: string, prefix: string) {
  const count = await db.proposal.count({ where: { organizationId } });
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(count + 1).padStart(4, "0")}`;
}

export function listProposals(organizationId: string) {
  return db.proposal.findMany({
    where: { organizationId },
    include: {
      deal: { select: { id: true, title: true } },
      contact: { select: { id: true, firstName: true, lastName: true } },
      company: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getProposal(organizationId: string, id: string) {
  const proposal = await db.proposal.findFirst({
    where: { id, organizationId },
    include: {
      deal: true,
      contact: true,
      company: true,
      items: { orderBy: { order: "asc" } },
    },
  });
  if (!proposal) notFound("Proposal");
  return proposal;
}

export async function createProposal(organizationId: string, input: ProposalInput) {
  requireField(input.title, "Title");
  const number = await nextDocumentNumber(organizationId, "PRO");
  return db.proposal.create({
    data: {
      organizationId,
      number,
      title: input.title,
      dealId: input.dealId,
      contactId: input.contactId,
      companyId: input.companyId,
      summary: input.summary,
      currency: input.currency ?? "USD",
      validUntil: input.validUntil,
      totalAmount: computeTotal(input.items),
      items: {
        create: input.items.map((item, order) => ({ ...item, order })),
      },
    },
    include: { items: true },
  });
}

export async function updateProposal(
  organizationId: string,
  id: string,
  input: Partial<ProposalInput>
) {
  const existing = await db.proposal.findFirst({ where: { id, organizationId } });
  if (!existing) notFound("Proposal");

  return db.$transaction(async (tx) => {
    if (input.items) {
      await tx.proposalItem.deleteMany({ where: { proposalId: id } });
    }
    return tx.proposal.update({
      where: { id },
      data: {
        title: input.title,
        dealId: input.dealId,
        contactId: input.contactId,
        companyId: input.companyId,
        summary: input.summary,
        currency: input.currency,
        validUntil: input.validUntil,
        ...(input.items
          ? {
              totalAmount: computeTotal(input.items),
              items: { create: input.items.map((item, order) => ({ ...item, order })) },
            }
          : {}),
      },
      include: { items: true },
    });
  });
}

export async function setProposalStatus(
  organizationId: string,
  id: string,
  status: "DRAFT" | "SENT" | "VIEWED" | "ACCEPTED" | "REJECTED" | "EXPIRED"
) {
  const existing = await db.proposal.findFirst({ where: { id, organizationId } });
  if (!existing) notFound("Proposal");
  return db.proposal.update({
    where: { id },
    data: {
      status,
      sentAt: status === "SENT" ? new Date() : existing.sentAt,
      respondedAt: ["ACCEPTED", "REJECTED"].includes(status)
        ? new Date()
        : existing.respondedAt,
    },
  });
}

export async function deleteProposal(organizationId: string, id: string) {
  const existing = await db.proposal.findFirst({ where: { id, organizationId } });
  if (!existing) notFound("Proposal");
  await db.proposal.delete({ where: { id } });
}
