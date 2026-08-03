import { PERMISSIONS } from '@ayv/types';

import type { Prisma } from '../../../generated/prisma';

import type { AuthPrincipal } from './auth';

export const PROJECT_INCLUDE = {
  client: { select: { id: true, name: true, logoUrl: true } },
  manager: { select: { id: true, name: true, email: true, avatarUrl: true } },
  members: {
    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
  },
} satisfies Prisma.ProjectInclude;

type ProjectWithRelations = Prisma.ProjectGetPayload<{ include: typeof PROJECT_INCLUDE }>;

/** Roles permitted to see cost and margin. Everyone else gets nulls. */
const FINANCE_VISIBLE_PERMISSION = PERMISSIONS.PNL_READ;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * A project is visible to anyone managing it or assigned to it — team
 * membership on the project itself is the meaningful boundary here, not the
 * org chart. Mirrors ProjectsService#visibilityFilter.
 */
export function projectVisibilityFilter(principal: AuthPrincipal): Prisma.ProjectWhereInput {
  if (principal.clientId) return { clientId: principal.clientId };

  const scope = principal.permissionScopes[PERMISSIONS.PROJECT_READ] ?? 'OWN';
  if (scope === 'ALL') return {};

  return {
    OR: [
      { managerId: principal.userId },
      { members: { some: { userId: principal.userId } } },
      { tasks: { some: { assigneeId: principal.userId } } },
    ],
  };
}

/** Mirrors apps/api's ProjectsService#present, including field-level redaction. */
export function presentProject(project: ProjectWithRelations, principal: AuthPrincipal) {
  const canSeeFinancials = principal.permissions.includes(FINANCE_VISIBLE_PERMISSION);

  const budget = project.budget === null ? null : Number(project.budget);
  const internalCost = project.internalCost === null ? null : Number(project.internalCost);
  const margin =
    budget !== null && internalCost !== null && budget > 0
      ? Number((((budget - internalCost) / budget) * 100).toFixed(1))
      : null;

  return {
    id: project.id,
    name: project.name,
    code: project.code,
    description: project.description,
    status: project.status,
    priority: project.priority,
    services: project.services,
    progress: project.progress,
    client: project.client,
    manager: project.manager ? { ...project.manager, initials: initials(project.manager.name) } : null,
    members: project.members.map((member) => ({
      ...member.user,
      initials: initials(member.user.name),
      allocation: member.allocation,
    })),
    startDate: project.startDate?.toISOString() ?? null,
    dueDate: project.dueDate?.toISOString() ?? null,
    completedAt: project.completedAt?.toISOString() ?? null,
    currency: project.currency,
    budget: canSeeFinancials ? budget : null,
    internalCost: canSeeFinancials ? internalCost : null,
    margin: canSeeFinancials ? margin : null,
    createdAt: project.createdAt.toISOString(),
  };
}
