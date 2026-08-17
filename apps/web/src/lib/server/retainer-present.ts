import type { Prisma } from '../../../generated/prisma';

export const RETAINER_STATUSES = ['ACTIVE', 'PAUSED', 'ENDED'] as const;

export interface TemplateItem {
  label: string;
  quantity: number;
}

/** Reads the committed-per-cycle template JSON into a clean list. */
export function parseTemplate(raw: unknown): TemplateItem[] {
  if (!Array.isArray(raw)) return [];
  const items: TemplateItem[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue;
    const { label, quantity } = entry as Record<string, unknown>;
    if (typeof label !== 'string' || !label.trim()) continue;
    const qty = typeof quantity === 'number' ? quantity : Number(quantity);
    items.push({ label: label.trim(), quantity: Number.isFinite(qty) && qty > 0 ? Math.round(qty) : 1 });
  }
  return items;
}

interface DeliverableRow {
  id: string;
  label: string;
  committed: number;
  delivered: number;
  position: number;
}

export function presentRetainer(
  retainer: {
    id: string;
    title: string;
    client: { id: string; name: string } | null;
    packageId: string | null;
    monthlyValue: Prisma.Decimal;
    currency: string;
    billingCycle: string;
    startDate: Date | null;
    status: string;
    deliverablesTemplate: Prisma.JsonValue;
  },
  deliverables: DeliverableRow[],
  period: { month: number; year: number },
) {
  const items = [...deliverables].sort((a, b) => a.position - b.position);
  const committedTotal = items.reduce((sum, item) => sum + item.committed, 0);
  const deliveredTotal = items.reduce((sum, item) => sum + item.delivered, 0);

  return {
    id: retainer.id,
    title: retainer.title,
    client: retainer.client,
    packageId: retainer.packageId,
    monthlyValue: Number(retainer.monthlyValue),
    currency: retainer.currency,
    billingCycle: retainer.billingCycle,
    startDate: retainer.startDate?.toISOString() ?? null,
    status: retainer.status,
    deliverablesTemplate: parseTemplate(retainer.deliverablesTemplate),
    period: {
      month: period.month,
      year: period.year,
      generated: items.length > 0,
      committedTotal,
      deliveredTotal,
      items: items.map((item) => ({
        id: item.id,
        label: item.label,
        committed: item.committed,
        delivered: item.delivered,
      })),
    },
  };
}
