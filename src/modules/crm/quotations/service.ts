import { db } from "@/lib/db";
import { notFound, requireField } from "@/modules/crm/shared";

export type QuotationItemInput = {
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
};

export type QuotationInput = {
  title: string;
  dealId?: string;
  contactId?: string;
  companyId?: string;
  currency?: string;
  taxPercent?: number;
  validUntil?: Date;
  items: QuotationItemInput[];
};

function computeTotal(items: QuotationItemInput[], taxPercent = 0): number {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  return subtotal * (1 + taxPercent / 100);
}

async function nextDocumentNumber(organizationId: string) {
  const count = await db.quotation.count({ where: { organizationId } });
  const year = new Date().getFullYear();
  return `QUO-${year}-${String(count + 1).padStart(4, "0")}`;
}

export function listQuotations(organizationId: string) {
  return db.quotation.findMany({
    where: { organizationId },
    include: {
      deal: { select: { id: true, title: true } },
      contact: { select: { id: true, firstName: true, lastName: true } },
      company: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getQuotation(organizationId: string, id: string) {
  const quotation = await db.quotation.findFirst({
    where: { id, organizationId },
    include: {
      deal: true,
      contact: true,
      company: true,
      items: { orderBy: { order: "asc" } },
    },
  });
  if (!quotation) notFound("Quotation");
  return quotation;
}

export async function createQuotation(organizationId: string, input: QuotationInput) {
  requireField(input.title, "Title");
  const number = await nextDocumentNumber(organizationId);
  return db.quotation.create({
    data: {
      organizationId,
      number,
      title: input.title,
      dealId: input.dealId,
      contactId: input.contactId,
      companyId: input.companyId,
      currency: input.currency ?? "USD",
      taxPercent: input.taxPercent ?? 0,
      validUntil: input.validUntil,
      totalAmount: computeTotal(input.items, input.taxPercent),
      items: {
        create: input.items.map((item, order) => ({ ...item, order })),
      },
    },
    include: { items: true },
  });
}

export async function updateQuotation(
  organizationId: string,
  id: string,
  input: Partial<QuotationInput>
) {
  const existing = await db.quotation.findFirst({ where: { id, organizationId } });
  if (!existing) notFound("Quotation");

  return db.$transaction(async (tx) => {
    if (input.items) {
      await tx.quotationItem.deleteMany({ where: { quotationId: id } });
    }
    return tx.quotation.update({
      where: { id },
      data: {
        title: input.title,
        dealId: input.dealId,
        contactId: input.contactId,
        companyId: input.companyId,
        currency: input.currency,
        taxPercent: input.taxPercent,
        validUntil: input.validUntil,
        ...(input.items
          ? {
              totalAmount: computeTotal(
                input.items,
                input.taxPercent ?? Number(existing.taxPercent)
              ),
              items: { create: input.items.map((item, order) => ({ ...item, order })) },
            }
          : {}),
      },
      include: { items: true },
    });
  });
}

export async function setQuotationStatus(
  organizationId: string,
  id: string,
  status: "DRAFT" | "SENT" | "VIEWED" | "ACCEPTED" | "REJECTED" | "EXPIRED"
) {
  const existing = await db.quotation.findFirst({ where: { id, organizationId } });
  if (!existing) notFound("Quotation");
  return db.quotation.update({
    where: { id },
    data: { status, sentAt: status === "SENT" ? new Date() : existing.sentAt },
  });
}

export async function deleteQuotation(organizationId: string, id: string) {
  const existing = await db.quotation.findFirst({ where: { id, organizationId } });
  if (!existing) notFound("Quotation");
  await db.quotation.delete({ where: { id } });
}
