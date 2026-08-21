import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

/**
 * Removes a channel. The creator can remove their own; a manager can remove
 * any. DMs aren't deletable here — they're private threads, not shared rooms.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.COMM_USE], async (principal) => {
    const { id } = await params;

    const channel = await prisma.conversation.findFirst({
      where: { id, type: 'CHANNEL' },
      select: { id: true, createdById: true },
    });
    if (!channel) return errorResponse(404, 'NOT_FOUND', 'Channel not found');

    const canManage = principal.permissions.includes(PERMISSIONS.ANNOUNCEMENT_MANAGE);
    if (!canManage && channel.createdById !== principal.userId) {
      return errorResponse(403, 'INSUFFICIENT_PERMISSION', 'Cannot delete this channel');
    }

    await prisma.conversation.delete({ where: { id } });
    return successResponse({ removed: true });
  });
}
