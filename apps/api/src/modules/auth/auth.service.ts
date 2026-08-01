import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomUUID } from 'node:crypto';

import type { LoginResponse, Permission } from '@ayv/types';
import { RequestContextStore } from '@/common/context/request-context';
import type { AuthPrincipal } from '@/common/decorators';
import type { AppConfig } from '@/config/configuration';
import { PRISMA, type PrismaService } from '@/infra/prisma/prisma.module';
import { AuditService } from '@/modules/audit/audit.service';
import { RbacService } from '@/modules/rbac/rbac.service';

import type { ChangePasswordDto, LoginDto, RegisterDto } from './dto/auth.dto';

interface SessionContext {
  ipAddress?: string;
  userAgent?: string;
}

const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<{ app: AppConfig }, true>,
    private readonly rbac: RbacService,
    private readonly audit: AuditService,
  ) {}

  private get jwtConfig(): AppConfig['jwt'] {
    return this.config.get('app.jwt', { infer: true }) as AppConfig['jwt'];
  }

  // ─── Registration ────────────────────────────────────────────────────────

  /**
   * Creates an organisation, its twelve system roles, and the first Super
   * Admin — all in one transaction, so a partial failure cannot leave an
   * organisation without an administrator.
   */
  async register(dto: RegisterDto, session: SessionContext): Promise<LoginResponse> {
    const slug = await this.generateUniqueSlug(dto.organizationName);

    const existing = await RequestContextStore.runUnscoped(() =>
      this.prisma.user.findFirst({
        where: { email: dto.email.toLowerCase() },
        select: { id: true },
      }),
    );
    if (existing) throw new ConflictException('An account with this email already exists');

    const passwordHash = await argon2.hash(dto.password, ARGON2_OPTIONS);

    const userId = await RequestContextStore.runUnscoped(async () => {
      const organization = await this.prisma.organization.create({
        data: { name: dto.organizationName, slug },
        select: { id: true },
      });

      const roleIds = await this.rbac.provisionSystemRoles(organization.id);
      const superAdminRoleId = roleIds.get('SUPER_ADMIN');
      if (!superAdminRoleId) throw new Error('System roles were not provisioned correctly');

      const user = await this.prisma.user.create({
        data: {
          organizationId: organization.id,
          email: dto.email.toLowerCase(),
          passwordHash,
          name: dto.name,
          phone: dto.phone,
          roleId: superAdminRoleId,
          userType: 'EMPLOYEE',
          status: 'ACTIVE',
          joinedAt: new Date(),
          passwordChangedAt: new Date(),
        },
        select: { id: true, organizationId: true },
      });

      return user.id;
    });

    const principal = await this.loadPrincipal(userId);
    if (!principal) throw new Error('Failed to load the newly created account');

    await this.audit.record({
      action: 'REGISTER',
      entity: 'Organization',
      entityId: principal.organizationId,
      after: { name: dto.organizationName, slug },
      organizationId: principal.organizationId,
      actorId: userId,
    });

    return this.issueSession(principal, session);
  }

  // ─── Login ───────────────────────────────────────────────────────────────

  async login(dto: LoginDto, session: SessionContext): Promise<LoginResponse> {
    const user = await RequestContextStore.runUnscoped(() =>
      this.prisma.user.findFirst({
        where: { email: dto.email.toLowerCase(), deletedAt: null },
        select: { id: true, passwordHash: true, status: true },
      }),
    );

    // Always verify against *something* so a missing account and a wrong
    // password take indistinguishable time.
    const hash = user?.passwordHash ?? (await this.dummyHash());
    const passwordMatches = await argon2.verify(hash, dto.password).catch(() => false);

    if (!user || !user.passwordHash || !passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('This account is not active. Contact your administrator.');
    }

    const principal = await this.loadPrincipal(user.id);
    if (!principal) throw new UnauthorizedException('Invalid email or password');

    await RequestContextStore.runUnscoped(() =>
      this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date(), lastActiveAt: new Date() },
      }),
    );

    await this.audit.record({
      action: 'LOGIN',
      entity: 'User',
      entityId: user.id,
      organizationId: principal.organizationId,
      actorId: user.id,
    });

    return this.issueSession(principal, session);
  }

  // ─── Refresh with rotation and reuse detection ───────────────────────────

  /**
   * Rotates the refresh token.
   *
   * Every refresh mints a new token and revokes the presented one. If a token
   * that has already been used is presented again, the entire session family
   * is revoked — turning stolen-token replay from a silent compromise into a
   * detected incident that forces re-authentication.
   */
  async refresh(refreshToken: string, session: SessionContext): Promise<LoginResponse> {
    const jwtConfig = this.jwtConfig;

    let payload: { sub: string; family: string; type: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, { secret: jwtConfig.refreshSecret });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (payload.type !== 'refresh') throw new UnauthorizedException('Invalid token type');

    const tokenHash = this.hashToken(refreshToken);

    const stored = await RequestContextStore.runUnscoped(() =>
      this.prisma.session.findFirst({ where: { refreshTokenHash: tokenHash } }),
    );

    if (!stored) {
      // The token verifies but is not on record: it was already rotated away.
      // Treat the whole family as compromised.
      await this.revokeFamily(payload.family);
      this.logger.warn(`Refresh token reuse detected for session family ${payload.family}`);
      throw new UnauthorizedException('Session revoked. Please sign in again.');
    }

    if (stored.revokedAt) {
      await this.revokeFamily(stored.familyId);
      throw new UnauthorizedException('Session revoked. Please sign in again.');
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired. Please sign in again.');
    }

    await RequestContextStore.runUnscoped(() =>
      this.prisma.session.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      }),
    );

    const principal = await this.loadPrincipal(stored.userId);
    if (!principal) throw new UnauthorizedException('Account is no longer active');

    return this.issueSession(principal, session, stored.familyId);
  }

  // ─── Logout ──────────────────────────────────────────────────────────────

  async logout(refreshToken: string): Promise<{ success: boolean }> {
    const tokenHash = this.hashToken(refreshToken);

    await RequestContextStore.runUnscoped(() =>
      this.prisma.session.updateMany({
        where: { refreshTokenHash: tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    );

    return { success: true };
  }

  async logoutAll(userId: string): Promise<{ success: boolean; revoked: number }> {
    const result = await RequestContextStore.runUnscoped(() =>
      this.prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    );

    return { success: true, revoked: result.count };
  }

  // ─── Password ────────────────────────────────────────────────────────────

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<{ success: boolean }> {
    const user = await RequestContextStore.runUnscoped(() =>
      this.prisma.user.findFirst({ where: { id: userId }, select: { passwordHash: true } }),
    );

    if (!user?.passwordHash) throw new BadRequestException('Password login is not enabled');

    const matches = await argon2.verify(user.passwordHash, dto.currentPassword).catch(() => false);
    if (!matches) throw new UnauthorizedException('Current password is incorrect');

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('The new password must differ from the current one');
    }

    const passwordHash = await argon2.hash(dto.newPassword, ARGON2_OPTIONS);

    await RequestContextStore.runUnscoped(() =>
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash, passwordChangedAt: new Date() },
      }),
    );

    // Changing a password invalidates every other device.
    await this.logoutAll(userId);

    await this.audit.record({ action: 'CHANGE_PASSWORD', entity: 'User', entityId: userId });

    return { success: true };
  }

  // ─── Sessions ────────────────────────────────────────────────────────────

  async listSessions(userId: string) {
    const sessions = await RequestContextStore.runUnscoped(() =>
      this.prisma.session.findMany({
        where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { lastUsedAt: 'desc' },
        select: {
          id: true,
          userAgent: true,
          ipAddress: true,
          deviceLabel: true,
          createdAt: true,
          lastUsedAt: true,
        },
      }),
    );

    return sessions;
  }

  async revokeSession(userId: string, sessionId: string): Promise<{ success: boolean }> {
    await RequestContextStore.runUnscoped(() =>
      this.prisma.session.updateMany({
        where: { id: sessionId, userId },
        data: { revokedAt: new Date() },
      }),
    );

    return { success: true };
  }

  // ─── Internals ───────────────────────────────────────────────────────────

  private async issueSession(
    principal: AuthPrincipal,
    session: SessionContext,
    familyId: string = randomUUID(),
  ): Promise<LoginResponse> {
    const jwtConfig = this.jwtConfig;

    const accessToken = await this.jwt.signAsync(
      {
        sub: principal.userId,
        org: principal.organizationId,
        role: principal.roleKey,
        type: 'access',
      },
      // `expiresIn` is typed as a literal duration union; ours comes from
      // validated configuration, so the cast is the narrowest fix available.
      {
        secret: jwtConfig.accessSecret,
        expiresIn: jwtConfig.accessExpiresIn as `${number}${'s' | 'm' | 'h' | 'd'}`,
      },
    );

    const refreshToken = await this.jwt.signAsync(
      { sub: principal.userId, family: familyId, type: 'refresh' },
      {
        secret: jwtConfig.refreshSecret,
        expiresIn: jwtConfig.refreshExpiresIn as `${number}${'s' | 'm' | 'h' | 'd'}`,
      },
    );

    await RequestContextStore.runUnscoped(() =>
      this.prisma.session.create({
        data: {
          userId: principal.userId,
          refreshTokenHash: this.hashToken(refreshToken),
          familyId,
          userAgent: session.userAgent,
          ipAddress: session.ipAddress,
          expiresAt: this.refreshExpiryDate(jwtConfig.refreshExpiresIn),
        },
      }),
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: this.durationToSeconds(jwtConfig.accessExpiresIn),
      user: {
        id: principal.userId,
        name: principal.name,
        email: principal.email,
        avatarUrl: null,
        initials: this.initials(principal.name),
        userType: 'EMPLOYEE',
        status: 'ACTIVE',
        organizationId: principal.organizationId,
        clientId: principal.clientId,
        role: { id: principal.roleId, key: principal.roleKey as never, name: principal.roleKey },
        permissions: principal.permissions,
      },
    };
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await RequestContextStore.runUnscoped(() =>
      this.prisma.session.updateMany({
        where: { familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    );
  }

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

    for (const grant of user.role.permissions) {
      granted.add(grant.permission.key);
      scopes[grant.permission.key] = grant.scope;
    }

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

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async dummyHash(): Promise<string> {
    return argon2.hash('constant-time-placeholder-value', ARGON2_OPTIONS);
  }

  private initials(name: string): string {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }

  private durationToSeconds(duration: string): number {
    const match = /^(\d+)([smhd])$/.exec(duration.trim());
    if (!match) return 900;
    const value = Number(match[1]);
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86_400 };
    return value * (multipliers[match[2]] ?? 60);
  }

  private refreshExpiryDate(duration: string): Date {
    return new Date(Date.now() + this.durationToSeconds(duration) * 1000);
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    const base =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'organisation';

    for (let attempt = 0; attempt < 50; attempt += 1) {
      const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
      const taken = await RequestContextStore.runUnscoped(() =>
        this.prisma.organization.findUnique({ where: { slug: candidate }, select: { id: true } }),
      );
      if (!taken) return candidate;
    }

    return `${base}-${randomUUID().slice(0, 8)}`;
  }
}
