import type { Permission } from '@ayv/types';

import type { AuthPrincipal } from './auth';

export type Scope = 'ALL' | 'TEAM' | 'OWN';

/**
 * Scope resolution.
 *
 * Mirrors apps/api's common/scope/scope.util.ts: the permission check
 * decides *whether* an actor may touch a resource; this decides *which
 * rows*, via the where clause the caller applies to the query.
 */
export function scopeOf(principal: AuthPrincipal, permission: Permission): Scope {
  return principal.permissionScopes[permission] ?? 'OWN';
}

export interface OwnershipFields {
  /** Column holding the owning user id, e.g. `ownerId` or `assigneeId`. */
  ownerField: string;
  /** Optional column holding the owning team id. */
  teamField?: string;
}

/** Builds the Prisma where fragment for a scoped read. */
export function scopeFilter(
  principal: AuthPrincipal,
  permission: Permission,
  fields: OwnershipFields,
): Record<string, unknown> {
  const scope = scopeOf(principal, permission);

  if (scope === 'ALL') return {};

  if (scope === 'TEAM') {
    if (!principal.teamId) {
      return { [fields.ownerField]: principal.userId };
    }

    if (fields.teamField) {
      return { [fields.teamField]: principal.teamId };
    }

    return {
      OR: [
        { [fields.ownerField]: principal.userId },
        { [fields.ownerField.replace(/Id$/, '')]: { teamId: principal.teamId } },
      ],
    };
  }

  return { [fields.ownerField]: principal.userId };
}
