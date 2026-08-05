import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { invalidatePrincipals } from '@/lib/server/auth';
import { prisma } from '@/lib/server/db';
import { canAssignRoleLevel, managerWouldCycle } from '@/lib/server/hierarchy';
import { EMPLOYEE_SELECT, presentEmployee } from '@/lib/server/hrm-present';
import { errorResponse, successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

const VALID_STATUSES = new Set(['ACTIVE', 'INVITED', 'SUSPENDED', 'OFFBOARDED']);

/**
 * Updates a team member's role, reporting line, profile or status.
 *
 * Role changes go through the same seniority guard as user creation, and
 * additionally refuse self-edits: without that, anyone holding USER_UPDATE
 * could promote themselves, which would make the role hierarchy advisory
 * rather than enforced.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.USER_UPDATE], async (principal) => {
    const { id } = await params;

    let body: {
      name?: unknown;
      roleId?: unknown;
      managerId?: unknown;
      designation?: unknown;
      department?: unknown;
      status?: unknown;
    };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const target = await prisma.user.findFirst({
      where: { id },
      select: { id: true, role: { select: { level: true } } },
    });
    if (!target) return errorResponse(404, 'NOT_FOUND', 'User not found');

    const isSelf = target.id === principal.userId;

    // You may not act on someone as senior as you — that would let peers
    // suspend or demote each other, and juniors edit their own manager.
    if (!isSelf && !canAssignRoleLevel(principal, target.role.level)) {
      return errorResponse(
        403,
        'INSUFFICIENT_PERMISSION',
        'You cannot modify a user at or above your own level of seniority',
      );
    }

    const data: Record<string, unknown> = {};

    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim();
    if (body.designation !== undefined) {
      data.designation = typeof body.designation === 'string' ? body.designation : null;
    }
    if (body.department !== undefined) {
      data.department = typeof body.department === 'string' ? body.department : null;
    }

    if (typeof body.status === 'string') {
      if (!VALID_STATUSES.has(body.status)) {
        return errorResponse(400, 'VALIDATION_ERROR', `status must be one of: ${[...VALID_STATUSES].join(', ')}`);
      }
      if (isSelf && body.status !== 'ACTIVE') {
        return errorResponse(400, 'VALIDATION_ERROR', 'You cannot deactivate your own account');
      }
      data.status = body.status;
    }

    if (typeof body.roleId === 'string' && body.roleId) {
      if (isSelf) {
        return errorResponse(403, 'INSUFFICIENT_PERMISSION', 'You cannot change your own role');
      }

      const role = await prisma.role.findFirst({
        where: { id: body.roleId },
        select: { id: true, level: true },
      });
      if (!role) return errorResponse(404, 'NOT_FOUND', 'Role not found');

      if (!canAssignRoleLevel(principal, role.level)) {
        return errorResponse(
          403,
          'INSUFFICIENT_PERMISSION',
          'You cannot assign a role at or above your own level of seniority',
        );
      }
      data.roleId = role.id;
    }

    if (body.managerId !== undefined) {
      if (body.managerId === null || body.managerId === '') {
        data.managerId = null;
      } else if (typeof body.managerId === 'string') {
        const manager = await prisma.user.findFirst({
          where: { id: body.managerId },
          select: { id: true },
        });
        if (!manager) return errorResponse(404, 'NOT_FOUND', 'Manager not found');

        if (await managerWouldCycle(id, manager.id)) {
          return errorResponse(
            400,
            'VALIDATION_ERROR',
            'That reporting line would create a loop — the chosen manager already reports to this user',
          );
        }
        data.managerId = manager.id;
      }
    }

    if (Object.keys(data).length === 0) {
      return errorResponse(400, 'VALIDATION_ERROR', 'No supported fields to update');
    }

    await prisma.user.update({ where: { id }, data });

    // Role, status and reporting line all feed the cached principal.
    invalidatePrincipals();

    const updated = await prisma.user.findFirstOrThrow({ where: { id }, select: EMPLOYEE_SELECT });
    return successResponse(presentEmployee(updated));
  });
}

/** Deactivates rather than deletes — a user is referenced by everything they touched. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.USER_DELETE], async (principal) => {
    const { id } = await params;

    if (id === principal.userId) {
      return errorResponse(400, 'VALIDATION_ERROR', 'You cannot deactivate your own account');
    }

    const target = await prisma.user.findFirst({
      where: { id },
      select: { id: true, role: { select: { level: true } }, _count: { select: { reports: true } } },
    });
    if (!target) return errorResponse(404, 'NOT_FOUND', 'User not found');

    if (!canAssignRoleLevel(principal, target.role.level)) {
      return errorResponse(
        403,
        'INSUFFICIENT_PERMISSION',
        'You cannot deactivate a user at or above your own level of seniority',
      );
    }

    if (target._count.reports > 0) {
      return errorResponse(
        400,
        'VALIDATION_ERROR',
        `${target._count.reports} person(s) report to this user — reassign them first`,
      );
    }

    await prisma.user.update({ where: { id }, data: { status: 'OFFBOARDED' } });
    invalidatePrincipals();

    return successResponse({ success: true });
  });
}
