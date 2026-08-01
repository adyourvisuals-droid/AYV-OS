import { db } from "@/lib/db";
import { notFound, requireField } from "@/modules/crm/shared";

export type ContractInput = {
  title: string;
  dealId?: string;
  contactId?: string;
  companyId?: string;
  value?: number;
  currency?: string;
  startDate?: Date;
  endDate?: Date;
  content?: string;
};

async function nextDocumentNumber(organizationId: string) {
  const count = await db.contract.count({ where: { organizationId } });
  const year = new Date().getFullYear();
  return `CON-${year}-${String(count + 1).padStart(4, "0")}`;
}

export function listContracts(organizationId: string) {
  return db.contract.findMany({
    where: { organizationId },
    include: {
      deal: { select: { id: true, title: true } },
      contact: { select: { id: true, firstName: true, lastName: true } },
      company: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getContract(organizationId: string, id: string) {
  const contract = await db.contract.findFirst({
    where: { id, organizationId },
    include: { deal: true, contact: true, company: true },
  });
  if (!contract) notFound("Contract");
  return contract;
}

export async function createContract(organizationId: string, input: ContractInput) {
  requireField(input.title, "Title");
  const number = await nextDocumentNumber(organizationId);
  return db.contract.create({
    data: { organizationId, number, ...input, currency: input.currency ?? "USD" },
  });
}

export async function updateContract(
  organizationId: string,
  id: string,
  input: Partial<ContractInput>
) {
  const existing = await db.contract.findFirst({ where: { id, organizationId } });
  if (!existing) notFound("Contract");
  return db.contract.update({ where: { id }, data: input });
}

export async function setContractStatus(
  organizationId: string,
  id: string,
  status: "DRAFT" | "SENT" | "SIGNED" | "EXPIRED" | "TERMINATED"
) {
  const existing = await db.contract.findFirst({ where: { id, organizationId } });
  if (!existing) notFound("Contract");
  return db.contract.update({
    where: { id },
    data: { status, signedAt: status === "SIGNED" ? new Date() : existing.signedAt },
  });
}

export async function deleteContract(organizationId: string, id: string) {
  const existing = await db.contract.findFirst({ where: { id, organizationId } });
  if (!existing) notFound("Contract");
  await db.contract.delete({ where: { id } });
}
