import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

/**
 * Opens (or finds) the 1:1 thread between the caller and another user. DMs are
 * unique per pair — asking again returns the same conversation, never a
 * duplicate.
 */
export async function POST(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.COMM_USE], async (principal) => {
    const me = principal.userId;

    let body: { userId?: unknown };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const otherId = typeof body.userId === 'string' ? body.userId : '';
    if (!otherId || otherId === me) return errorResponse(400, 'VALIDATION_ERROR', 'A valid userId is required');

    const other = await prisma.user.findFirst({ where: { id: otherId }, select: { id: true } });
    if (!other) return errorResponse(404, 'NOT_FOUND', 'User not found');

    // A DM already exists if there's a DIRECT conversation both are members of.
    const existing = await prisma.conversation.findFirst({
      where: {
        type: 'DIRECT',
        AND: [{ members: { some: { userId: me } } }, { members: { some: { userId: otherId } } }],
      },
      select: { id: true },
    });

    let conversationId = existing?.id;
    if (!conversationId) {
      const created = await prisma.conversation.create({
        data: {
          organizationId: principal.organizationId,
          type: 'DIRECT',
          createdById: me,
          members: { create: [{ userId: me, lastReadAt: new Date() }, { userId: otherId }] },
        },
        select: { id: true },
      });
      conversationId = created.id;
    }

    return successResponse({ id: conversationId });
  });
}
