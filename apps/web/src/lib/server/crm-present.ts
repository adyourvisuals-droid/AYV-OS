import type { Prisma } from '../../../generated/prisma';

export const LEAD_INCLUDE = {
  owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
} satisfies Prisma.LeadInclude;

type LeadWithOwner = Prisma.LeadGetPayload<{ include: typeof LEAD_INCLUDE }>;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** Mirrors apps/api's LeadsService#present. */
export function presentLead(lead: LeadWithOwner) {
  const daysInStage = Math.floor((Date.now() - lead.stageChangedAt.getTime()) / 86_400_000);

  return {
    id: lead.id,
    name: lead.name,
    contactName: lead.contactName,
    email: lead.email,
    phone: lead.phone,
    company: lead.company,
    city: lead.city,
    source: lead.source,
    status: lead.status,
    temperature: lead.temperature,
    industry: lead.industry,
    services: lead.services,
    estimatedValue: Number(lead.estimatedValue),
    currency: lead.currency,
    score: lead.score,
    closeProbability: lead.closeProbability === null ? null : Number(lead.closeProbability),
    notes: lead.notes,
    lostReason: lead.lostReason,
    owner: lead.owner
      ? {
          id: lead.owner.id,
          name: lead.owner.name,
          email: lead.owner.email,
          avatarUrl: lead.owner.avatarUrl,
          initials: initials(lead.owner.name),
        }
      : null,
    convertedClientId: lead.convertedClientId,
    stageChangedAt: lead.stageChangedAt.toISOString(),
    daysInStage,
    lastActivityAt: lead.lastActivityAt?.toISOString() ?? null,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  };
}
