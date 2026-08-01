import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { Permission } from '@ayv/types';

export const IS_PUBLIC_KEY = 'ayv:isPublic';
export const PERMISSIONS_KEY = 'ayv:permissions';
export const AUDIT_KEY = 'ayv:audit';

/** Marks a route as reachable without authentication. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Requires every listed permission. Scope (ALL / TEAM / OWN) is resolved in the
 * data layer, not here — this guard answers "may they touch this resource at
 * all", the repository answers "which rows".
 */
export const RequirePermission = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export interface AuditOptions {
  action: string;
  entity: string;
}

/** Records the mutation in the audit log with a before/after diff. */
export const Audit = (options: AuditOptions) => SetMetadata(AUDIT_KEY, options);

export interface AuthPrincipal {
  userId: string;
  organizationId: string;
  email: string;
  name: string;
  roleId: string;
  roleKey: string;
  roleLevel: number;
  teamId: string | null;
  clientId: string | null;
  permissions: Permission[];
  permissionScopes: Record<string, 'ALL' | 'TEAM' | 'OWN'>;
}

/** Injects the authenticated principal. `@CurrentUser('userId')` picks a field. */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthPrincipal | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthPrincipal }>();
    const user = request.user;
    if (!user) return undefined;
    return field ? user[field] : user;
  },
);
