import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { Permission } from '@ayv/types';

import { IS_PUBLIC_KEY, PERMISSIONS_KEY, type AuthPrincipal } from '../decorators';

/**
 * Enforces `@RequirePermission(...)`.
 *
 * This answers "may this actor touch this resource at all". Which *rows* they
 * may touch is decided by scope resolution in the service layer, using
 * `principal.permissionScopes`.
 *
 * AI agents pass through this guard on exactly the same code path as humans —
 * that is what makes autonomous agents safe to deploy.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<{ user?: AuthPrincipal }>();
    const principal = request.user;
    if (!principal) throw new ForbiddenException('Authentication required');

    const held = new Set(principal.permissions);
    const missing = required.filter((permission) => !held.has(permission));

    if (missing.length > 0) {
      throw new ForbiddenException({
        code: 'INSUFFICIENT_PERMISSION',
        message: `Missing required permission: ${missing.join(', ')}`,
      });
    }

    return true;
  }
}
