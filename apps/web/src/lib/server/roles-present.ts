import type { Prisma } from '../../../generated/prisma';

export const ROLE_INCLUDE = {
  _count: { select: { users: true, permissions: true } },
} satisfies Prisma.RoleInclude;

type RoleRow = Prisma.RoleGetPayload<{ include: typeof ROLE_INCLUDE }>;

export function presentRole(role: RoleRow) {
  return {
    id: role.id,
    key: role.key,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    level: role.level,
    userCount: role._count.users,
    permissionCount: role._count.permissions,
    createdAt: role.createdAt.toISOString(),
  };
}
