import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { ALL_PERMISSIONS, PERMISSION_DESCRIPTIONS, SYSTEM_ROLES, type Permission } from '@ayv/types';
import { RequestContextStore } from '@/common/context/request-context';
import { PRISMA, type PrismaService } from '@/infra/prisma/prisma.module';

@Injectable()
export class RbacService {
  private readonly logger = new Logger(RbacService.name);

  constructor(@Inject(PRISMA) private readonly prisma: PrismaService) {}

  /**
   * Ensures every permission in the registry exists as a row.
   *
   * Idempotent, and safe to run on every boot: adding a permission to
   * `@ayv/types` is all a developer needs to do to make it assignable.
   */
  async syncPermissionRegistry(): Promise<void> {
    const existing = await RequestContextStore.runUnscoped(() =>
      this.prisma.permission.findMany({ select: { key: true } }),
    );
    const known = new Set(existing.map((row) => row.key));
    const missing = ALL_PERMISSIONS.filter((key) => !known.has(key));

    if (missing.length === 0) return;

    await RequestContextStore.runUnscoped(() =>
      this.prisma.permission.createMany({
        data: missing.map((key) => ({
          key,
          domain: key.split(':')[0],
          description: PERMISSION_DESCRIPTIONS[key] ?? null,
        })),
        skipDuplicates: true,
      }),
    );

    this.logger.log(`Registered ${missing.length} new permissions`);
  }

  /**
   * Creates the twelve system roles for a new organisation and returns them
   * keyed by role key. Called during registration, inside its transaction.
   */
  async provisionSystemRoles(organizationId: string): Promise<Map<string, string>> {
    await this.syncPermissionRegistry();

    const permissionRows = await RequestContextStore.runUnscoped(() =>
      this.prisma.permission.findMany({ select: { id: true, key: true } }),
    );
    const permissionIdByKey = new Map(permissionRows.map((row) => [row.key, row.id]));

    const roleIdByKey = new Map<string, string>();

    for (const definition of SYSTEM_ROLES) {
      const grants =
        definition.permissions === '*'
          ? ALL_PERMISSIONS.map((permission) => ({ permission, scope: 'ALL' as const }))
          : definition.permissions;

      // A role can list a permission more than once across the all/team/own
      // helpers; the last entry wins, matching how the matrix reads.
      const deduped = new Map<Permission, 'ALL' | 'TEAM' | 'OWN'>();
      for (const grant of grants) {
        deduped.set(grant.permission, grant.scope ?? 'ALL');
      }

      const role = await RequestContextStore.runUnscoped(() =>
        this.prisma.role.create({
          data: {
            organizationId,
            key: definition.key,
            name: definition.name,
            description: definition.description,
            level: definition.level,
            isSystem: true,
            permissions: {
              create: [...deduped.entries()]
                .filter(([permission]) => permissionIdByKey.has(permission))
                .map(([permission, scope]) => ({
                  permissionId: permissionIdByKey.get(permission)!,
                  scope,
                })),
            },
          },
          select: { id: true, key: true },
        }),
      );

      roleIdByKey.set(role.key, role.id);
    }

    return roleIdByKey;
  }

  async listRoles(organizationId: string) {
    return this.prisma.role.findMany({
      where: { organizationId },
      include: {
        permissions: { include: { permission: { select: { key: true } } } },
        _count: { select: { users: true } },
      },
      orderBy: { level: 'asc' },
    });
  }

  async listPermissions() {
    return RequestContextStore.runUnscoped(() =>
      this.prisma.permission.findMany({ orderBy: [{ domain: 'asc' }, { key: 'asc' }] }),
    );
  }

  /**
   * Reassigns a user's role.
   *
   * Refuses to demote the last remaining Super Admin — enforced here rather
   * than in the UI, because that is the only place it cannot be bypassed.
   */
  async assignRole(userId: string, roleId: string, organizationId: string) {
    const [user, role] = await Promise.all([
      this.prisma.user.findFirst({ where: { id: userId }, include: { role: true } }),
      this.prisma.role.findFirst({ where: { id: roleId } }),
    ]);

    if (!user) throw new NotFoundException('User not found');
    if (!role) throw new NotFoundException('Role not found');

    if (user.role.key === 'SUPER_ADMIN' && role.key !== 'SUPER_ADMIN') {
      const remaining = await this.prisma.user.count({
        where: {
          organizationId,
          status: 'ACTIVE',
          role: { key: 'SUPER_ADMIN' },
          id: { not: userId },
        },
      });

      if (remaining === 0) {
        throw new BadRequestException(
          'Cannot change the role of the only Super Admin. Promote another user first.',
        );
      }
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { roleId },
      include: { role: true },
    });
  }
}
