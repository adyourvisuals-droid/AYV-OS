import type { NextRequest } from 'next/server';

import { ALL_PERMISSIONS, PERMISSIONS, type Permission } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';
import { presentRole, ROLE_INCLUDE } from '@/lib/server/roles-present';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

const VALID_SCOPES = new Set(['ALL', 'TEAM', 'OWN']);

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.ROLE_READ], async () => {
    const { id } = await params;

    const role = await prisma.role.findFirst({
      where: { id },
      include: {
        ...ROLE_INCLUDE,
        permissions: { include: { permission: true } },
      },
    });
    if (!role) return errorResponse(404, 'NOT_FOUND', 'Role not found');

    return successResponse({
      ...presentRole(role),
      grants: role.permissions.map((grant) => ({
        permission: grant.permission.key,
        scope: grant.scope,
      })),
    });
  });
}

interface GrantInput {
  permission: unknown;
  scope: unknown;
}

/**
 * Updates a role's fields and, if `grants` is provided, replaces its entire
 * permission set — simplest correct semantics for a checkbox-list editor
 * that always submits the full desired state.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.ROLE_UPDATE], async () => {
    const { id } = await params;

    let body: { name?: unknown; description?: unknown; level?: unknown; grants?: unknown };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const role = await prisma.role.findFirst({ where: { id } });
    if (!role) return errorResponse(404, 'NOT_FOUND', 'Role not found');
    if (role.isSystem) {
      return errorResponse(400, 'VALIDATION_ERROR', 'System roles cannot be edited — create a custom role instead');
    }

    let grants: { permission: Permission; scope: 'ALL' | 'TEAM' | 'OWN' }[] | null = null;

    if (body.grants !== undefined) {
      if (!Array.isArray(body.grants)) {
        return errorResponse(400, 'VALIDATION_ERROR', 'grants must be an array');
      }

      const validKeys = new Set(ALL_PERMISSIONS);
      grants = [];
      for (const entry of body.grants as GrantInput[]) {
        const permission = typeof entry.permission === 'string' ? entry.permission : '';
        const scope = typeof entry.scope === 'string' ? entry.scope : 'ALL';
        if (!validKeys.has(permission as Permission) || !VALID_SCOPES.has(scope)) {
          return errorResponse(400, 'VALIDATION_ERROR', `Invalid grant: ${JSON.stringify(entry)}`);
        }
        grants.push({ permission: permission as Permission, scope: scope as 'ALL' | 'TEAM' | 'OWN' });
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.role.update({
        where: { id },
        data: {
          ...(typeof body.name === 'string' ? { name: body.name } : {}),
          ...(body.description !== undefined
            ? { description: typeof body.description === 'string' ? body.description : null }
            : {}),
          ...(typeof body.level === 'number' ? { level: body.level } : {}),
        },
      });

      if (grants !== null) {
        await tx.rolePermission.deleteMany({ where: { roleId: id } });

        if (grants.length > 0) {
          const permissionRows = await tx.permission.findMany({
            where: { key: { in: grants.map((grant) => grant.permission) } },
            select: { id: true, key: true },
          });
          const idByKey = new Map(permissionRows.map((row) => [row.key, row.id]));

          await tx.rolePermission.createMany({
            data: grants
              .filter((grant) => idByKey.has(grant.permission))
              .map((grant) => ({
                roleId: id,
                permissionId: idByKey.get(grant.permission)!,
                scope: grant.scope,
              })),
          });
        }
      }
    });

    const updated = await prisma.role.findFirstOrThrow({
      where: { id },
      include: { ...ROLE_INCLUDE, permissions: { include: { permission: true } } },
    });

    return successResponse({
      ...presentRole(updated),
      grants: updated.permissions.map((grant) => ({ permission: grant.permission.key, scope: grant.scope })),
    });
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.ROLE_DELETE], async () => {
    const { id } = await params;

    const role = await prisma.role.findFirst({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!role) return errorResponse(404, 'NOT_FOUND', 'Role not found');

    if (role.isSystem) {
      return errorResponse(400, 'VALIDATION_ERROR', 'System roles cannot be deleted');
    }
    if (role._count.users > 0) {
      return errorResponse(
        400,
        'VALIDATION_ERROR',
        `${role._count.users} user(s) still hold this role — reassign them first`,
      );
    }

    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId: id } }),
      prisma.role.delete({ where: { id } }),
    ]);

    return successResponse({ success: true });
  });
}
