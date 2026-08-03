import { PERMISSIONS } from '@ayv/types';

import type { Prisma } from '../../../generated/prisma';

import type { AuthPrincipal } from './auth';
import { scopeFilter } from './scope';

/**
 * Portal users are hard-scoped to their own client row, on top of whatever
 * the permission scope would otherwise allow. Mirrors ClientsService#visibilityFilter.
 */
export function clientVisibilityFilter(principal: AuthPrincipal): Prisma.ClientWhereInput {
  if (principal.clientId) return { id: principal.clientId };

  return scopeFilter(principal, PERMISSIONS.CLIENT_READ, {
    ownerField: 'accountManagerId',
  }) as Prisma.ClientWhereInput;
}

export const CLIENT_INCLUDE = {
  accountManager: { select: { id: true, name: true, email: true, avatarUrl: true } },
} satisfies Prisma.ClientInclude;

type ClientWithManager = Prisma.ClientGetPayload<{ include: typeof CLIENT_INCLUDE }>;

/** Mirrors apps/api's ClientsService#present. */
export function presentClient(client: ClientWithManager) {
  return {
    id: client.id,
    name: client.name,
    legalName: client.legalName,
    logoUrl: client.logoUrl,
    industry: client.industry,
    status: client.status,
    healthScore: client.healthScore,
    healthUpdatedAt: client.healthUpdatedAt?.toISOString() ?? null,
    email: client.email,
    phone: client.phone,
    website: client.website,
    city: client.city,
    services: client.services,
    monthlyRetainer: client.monthlyRetainer === null ? null : Number(client.monthlyRetainer),
    currency: client.currency,
    accountManager: client.accountManager
      ? {
          id: client.accountManager.id,
          name: client.accountManager.name,
          email: client.accountManager.email,
          avatarUrl: client.accountManager.avatarUrl,
          initials: client.accountManager.name
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase() ?? '')
            .join(''),
        }
      : null,
    contractStartDate: client.contractStartDate?.toISOString() ?? null,
    renewalDate: client.renewalDate?.toISOString() ?? null,
    createdAt: client.createdAt.toISOString(),
  };
}
