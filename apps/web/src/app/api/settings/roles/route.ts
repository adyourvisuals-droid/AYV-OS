import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';
import { presentRole, ROLE_INCLUDE } from '@/lib/server/roles-present';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.ROLE_READ], async () => {
    const roles = await prisma.role.findMany({
      include: ROLE_INCLUDE,
      orderBy: { level: 'asc' },
    });

    return successResponse(roles.map((role) => presentRole(role)));
  });
}

/** Creates a new custom role with no initial permission grants. */
export async function POST(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.ROLE_CREATE], async (principal) => {
    let body: { key?: unknown; name?: unknown; description?: unknown; level?: unknown };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const key = typeof body.key === 'string' ? body.key.trim().toUpperCase().replace(/\s+/g, '_') : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';

    if (!key || !name || !/^[A-Z][A-Z0-9_]*$/.test(key)) {
      return errorResponse(
        400,
        'VALIDATION_ERROR',
        'A name is required, and key must be uppercase letters, numbers and underscores',
      );
    }

    const existing = await prisma.role.findFirst({ where: { key } });
    if (existing) {
      return errorResponse(409, 'CONFLICT', `A role with key "${key}" already exists`);
    }

    const created = await prisma.role.create({
      data: {
        organizationId: principal.organizationId,
        key,
        name,
        description: typeof body.description === 'string' ? body.description : null,
        level: typeof body.level === 'number' ? body.level : 100,
        isSystem: false,
      },
      include: ROLE_INCLUDE,
    });

    return successResponse(presentRole(created));
  });
}
