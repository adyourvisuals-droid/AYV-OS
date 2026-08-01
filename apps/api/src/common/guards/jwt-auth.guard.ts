import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import type { Permission } from '@ayv/types';
import type { AppConfig } from '@/config/configuration';
import { PRISMA, type PrismaService } from '@/infra/prisma/prisma.module';

import { RequestContextStore } from '../context/request-context';
import { IS_PUBLIC_KEY, type AuthPrincipal } from '../decorators';

export interface AccessTokenPayload {
  sub: string;
  org: string;
  role: string;
  type: 'access';
}

/**
 * Verifies the access token, loads the principal with its effective
 * permissions, and populates the ambient request context — which is what makes
 * tenant scoping work for everything downstream.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<{ app: AppConfig }, true>,
    @Inject(PRISMA) private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthPrincipal }>();
    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedException('Authentication required');

    const jwtConfig = this.config.get('app.jwt', { infer: true }) as AppConfig['jwt'];

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: jwtConfig.accessSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    const principal = await this.loadPrincipal(payload.sub);
    if (!principal) throw new UnauthorizedException('Account is no longer active');

    request.user = principal;

    RequestContextStore.patch({
      organizationId: principal.organizationId,
      userId: principal.userId,
      clientId: principal.clientId ?? undefined,
      roleKey: principal.roleKey,
      permissions: principal.permissions,
      actorType: 'USER',
    });

    return true;
  }

  private extractToken(request: Request): string | undefined {
    const header = request.headers.authorization;
    if (!header) return undefined;
    const [scheme, value] = header.split(' ');
    return scheme?.toLowerCase() === 'bearer' ? value : undefined;
  }

  /**
   * Loads the user and flattens role + per-user overrides into an effective
   * permission set. Runs unscoped because the tenant is not yet known — this
   * is one of the few legitimate cross-tenant reads, and it is keyed by a
   * user id that came from a signed token.
   */
  private async loadPrincipal(userId: string): Promise<AuthPrincipal | null> {
    const user = await RequestContextStore.runUnscoped(() =>
      this.prisma.user.findFirst({
        where: { id: userId, deletedAt: null, status: 'ACTIVE' },
        include: {
          role: { include: { permissions: { include: { permission: true } } } },
          userPermissions: { include: { permission: true } },
        },
      }),
    );

    if (!user) return null;

    const scopes: Record<string, 'ALL' | 'TEAM' | 'OWN'> = {};
    const granted = new Set<string>();

    for (const rolePermission of user.role.permissions) {
      granted.add(rolePermission.permission.key);
      scopes[rolePermission.permission.key] = rolePermission.scope;
    }

    // Per-user overrides win, and an explicit deny beats every grant.
    for (const override of user.userPermissions) {
      if (override.granted) {
        granted.add(override.permission.key);
        scopes[override.permission.key] = override.scope;
      } else {
        granted.delete(override.permission.key);
        delete scopes[override.permission.key];
      }
    }

    return {
      userId: user.id,
      organizationId: user.organizationId,
      email: user.email,
      name: user.name,
      roleId: user.roleId,
      roleKey: user.role.key,
      roleLevel: user.role.level,
      teamId: user.teamId,
      clientId: user.clientId,
      permissions: [...granted] as Permission[],
      permissionScopes: scopes,
    };
  }
}
