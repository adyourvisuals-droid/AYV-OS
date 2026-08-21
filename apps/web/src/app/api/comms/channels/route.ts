import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

/** Creates a team channel. The creator is auto-joined; channels are org-public. */
export async function POST(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.COMM_USE], async (principal) => {
    let body: { name?: unknown; description?: unknown };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    // Slug-ish channel name: lowercase, spaces to hyphens, safe characters only.
    const raw = typeof body.name === 'string' ? body.name.trim().toLowerCase() : '';
    const name = raw.replace(/[^a-z0-9-\s]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 40);
    if (!name) return errorResponse(400, 'VALIDATION_ERROR', 'A channel name is required');

    const existing = await prisma.conversation.findFirst({ where: { type: 'CHANNEL', name } });
    if (existing) return errorResponse(409, 'CONFLICT', 'A channel with that name already exists');

    const created = await prisma.conversation.create({
      data: {
        organizationId: principal.organizationId,
        type: 'CHANNEL',
        name,
        description: typeof body.description === 'string' ? body.description.trim() || null : null,
        createdById: principal.userId,
        members: { create: { userId: principal.userId, lastReadAt: new Date() } },
      },
      select: { id: true, name: true, description: true },
    });

    return successResponse({ id: created.id, name: created.name, description: created.description, unread: 0 });
  });
}
