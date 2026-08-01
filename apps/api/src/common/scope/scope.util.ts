import type { Permission } from '@ayv/types';

import type { AuthPrincipal } from '../decorators';

export type Scope = 'ALL' | 'TEAM' | 'OWN';

/**
 * Scope resolution.
 *
 * The permission guard decides *whether* an actor may touch a resource; this
 * decides *which rows*. Keeping it in one place means `read:own` and
 * `read:all` hit the same service method and differ only in the generated
 * where clause — there is no parallel "my leads" code path to drift.
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

/**
 * Builds the Prisma where fragment for a scoped read.
 *
 * `TEAM` resolves through the owner's team rather than a denormalised column,
 * so moving someone between teams immediately changes what their manager sees
 * without a backfill.
 */
export function scopeFilter(
  principal: AuthPrincipal,
  permission: Permission,
  fields: OwnershipFields,
): Record<string, unknown> {
  const scope = scopeOf(principal, permission);

  if (scope === 'ALL') return {};

  if (scope === 'TEAM') {
    if (!principal.teamId) {
      // No team means "team" degrades to "own" — never to "everything".
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

/** True when the principal may act on a specific record under this permission. */
export function canAccessRecord(
  principal: AuthPrincipal,
  permission: Permission,
  record: { ownerId?: string | null; teamId?: string | null },
): boolean {
  const scope = scopeOf(principal, permission);
  if (scope === 'ALL') return true;
  if (scope === 'TEAM') {
    return record.teamId != null && record.teamId === principal.teamId
      ? true
      : record.ownerId === principal.userId;
  }
  return record.ownerId === principal.userId;
}
