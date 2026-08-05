import type { Prisma } from '../../../generated/prisma';

export const QUOTATION_INCLUDE = {
  lead: { select: { id: true, name: true } },
  client: { select: { id: true, name: true } },
  items: { orderBy: { position: 'asc' } },
} satisfies Prisma.QuotationInclude;

type QuotationWithRelations = Prisma.QuotationGetPayload<{ include: typeof QUOTATION_INCLUDE }>;

export function presentQuotation(quotation: QuotationWithRelations) {
  return {
    id: quotation.id,
    number: quotation.number,
    status: quotation.status,
    lead: quotation.lead,
    client: quotation.client,
    validUntil: quotation.validUntil?.toISOString() ?? null,
    subtotal: Number(quotation.subtotal),
    discount: Number(quotation.discount),
    taxRate: Number(quotation.taxRate),
    taxAmount: Number(quotation.taxAmount),
    total: Number(quotation.total),
    currency: quotation.currency,
    terms: quotation.terms,
    notes: quotation.notes,
    sentAt: quotation.sentAt?.toISOString() ?? null,
    items: quotation.items.map((item) => ({
      id: item.id,
      service: item.service,
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      amount: Number(item.amount),
    })),
    createdAt: quotation.createdAt.toISOString(),
    updatedAt: quotation.updatedAt.toISOString(),
  };
}

export interface QuotationLineInput {
  service: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
}

/**
 * A quotation is an estimate, not a tax invoice — one flat tax rate applied
 * after a single discount, unlike Invoice's per-line CGST/SGST/IGST split.
 */
export function computeQuotationTotals(lines: QuotationLineInput[], discount: number, taxRate: number) {
  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const taxable = Math.max(0, subtotal - discount);
  const taxAmount = taxable * (taxRate / 100);

  return {
    subtotal: Math.round(subtotal),
    discount: Math.round(discount),
    taxAmount: Math.round(taxAmount),
    total: Math.round(taxable + taxAmount),
  };
}

export function parseQuotationItems(raw: unknown): QuotationLineInput[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;

  const items: QuotationLineInput[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) return null;
    const { service, description, quantity, unitPrice } = entry as Record<string, unknown>;
    if (typeof description !== 'string' || !description.trim()) return null;
    if (typeof quantity !== 'number' || quantity <= 0) return null;
    if (typeof unitPrice !== 'number' || unitPrice < 0) return null;
    items.push({
      service: typeof service === 'string' ? service : null,
      description,
      quantity,
      unitPrice,
    });
  }
  return items;
}
