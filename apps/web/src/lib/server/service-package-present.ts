import type { Prisma } from '../../../generated/prisma';

export const BILLING_CYCLES = ['ONE_TIME', 'MONTHLY', 'QUARTERLY', 'ANNUAL'] as const;

export const SERVICE_CATEGORIES = [
  'BRANDING',
  'SOCIAL_MEDIA',
  'PERFORMANCE_MARKETING',
  'META_ADS',
  'GOOGLE_ADS',
  'WEBSITE',
  'VIDEO_EDITING',
  'GRAPHIC_DESIGN',
  'AI_CONTENT',
  'AI_VIDEO',
  'AUTOMATION',
  'CONSULTING',
] as const;

export interface PackageDeliverable {
  label: string;
  quantity: number;
}

/** Reads and cleans the deliverables JSON into a typed, well-formed list. */
export function parseDeliverables(raw: unknown): PackageDeliverable[] {
  if (!Array.isArray(raw)) return [];
  const items: PackageDeliverable[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue;
    const { label, quantity } = entry as Record<string, unknown>;
    if (typeof label !== 'string' || !label.trim()) continue;
    const qty = typeof quantity === 'number' ? quantity : Number(quantity);
    items.push({ label: label.trim(), quantity: Number.isFinite(qty) && qty > 0 ? Math.round(qty) : 1 });
  }
  return items;
}

export function presentServicePackage(pkg: {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  price: Prisma.Decimal;
  currency: string;
  billingCycle: string;
  deliverables: Prisma.JsonValue;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: pkg.id,
    name: pkg.name,
    category: pkg.category,
    description: pkg.description,
    price: Number(pkg.price),
    currency: pkg.currency,
    billingCycle: pkg.billingCycle,
    deliverables: parseDeliverables(pkg.deliverables),
    isActive: pkg.isActive,
    createdAt: pkg.createdAt.toISOString(),
    updatedAt: pkg.updatedAt.toISOString(),
  };
}
