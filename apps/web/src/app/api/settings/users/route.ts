import { randomBytes } from 'node:crypto';

import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { hashPassword } from '@/lib/server/auth';
import { prisma } from '@/lib/server/db';
import { canAssignRoleLevel } from '@/lib/server/hierarchy';
import { EMPLOYEE_SELECT, presentEmployee } from '@/lib/server/hrm-present';
import { errorResponse, successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.USER_READ], async () => {
    const users = await prisma.user.findMany({
      select: EMPLOYEE_SELECT,
      orderBy: [{ role: { level: 'asc' } }, { name: 'asc' }],
    });

    return successResponse(users.map((user) => presentEmployee(user)));
  });
}

/**
 * Creates a team member.
 *
 * There is no outbound email configured, so instead of an invitation link
 * this returns a one-time temporary password in the response. It is shown
 * to the administrator once and never stored in readable form — the user is
 * created with status INVITED so it is clear they have not signed in yet.
 */
export async function POST(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.USER_CREATE], async (principal) => {
    let body: {
      name?: unknown;
      email?: unknown;
      roleId?: unknown;
      managerId?: unknown;
      designation?: unknown;
      department?: unknown;
    };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const roleId = typeof body.roleId === 'string' ? body.roleId : '';

    if (!name || !email || !roleId) {
      return errorResponse(400, 'VALIDATION_ERROR', 'name, email and roleId are required');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return errorResponse(400, 'VALIDATION_ERROR', 'A valid email address is required');
    }

    const role = await prisma.role.findFirst({ where: { id: roleId }, select: { id: true, level: true } });
    if (!role) return errorResponse(404, 'NOT_FOUND', 'Role not found');

    // Without this, anyone who can create users could mint a peer or a
    // superior and escalate their own effective access.
    if (!canAssignRoleLevel(principal, role.level)) {
      return errorResponse(
        403,
        'INSUFFICIENT_PERMISSION',
        'You cannot assign a role at or above your own level of seniority',
      );
    }

    const existing = await prisma.user.findFirst({ where: { email }, select: { id: true } });
    if (existing) {
      return errorResponse(409, 'CONFLICT', `A user with the email ${email} already exists`);
    }

    let managerId: string | null = null;
    if (typeof body.managerId === 'string' && body.managerId) {
      const manager = await prisma.user.findFirst({
        where: { id: body.managerId },
        select: { id: true },
      });
      if (!manager) return errorResponse(404, 'NOT_FOUND', 'Manager not found');
      managerId = manager.id;
    }

    // URL-safe, and long enough that it is not worth guessing during the
    // window before the user sets their own.
    const temporaryPassword = randomBytes(9).toString('base64url');

    const created = await prisma.user.create({
      data: {
        organizationId: principal.organizationId,
        name,
        email,
        passwordHash: await hashPassword(temporaryPassword),
        roleId: role.id,
        managerId,
        designation: typeof body.designation === 'string' ? body.designation : null,
        department: typeof body.department === 'string' ? body.department : null,
        userType: 'EMPLOYEE',
        status: 'INVITED',
        joinedAt: new Date(),
        createdById: principal.userId,
      },
      select: EMPLOYEE_SELECT,
    });

    return successResponse({ ...presentEmployee(created), temporaryPassword });
  });
}
