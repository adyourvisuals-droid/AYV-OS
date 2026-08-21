import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { markConversationRead, presentMessage } from '@/lib/server/comms';
import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

const AUTHOR_SELECT = {
  id: true,
  body: true,
  createdAt: true,
  authorId: true,
  author: { select: { id: true, name: true, avatarUrl: true } },
} as const;

/**
 * A conversation's messages plus its header. Opening a conversation marks it
 * read (its unread badge clears), which is also what the periodic refresh
 * relies on to keep an open thread current.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.COMM_USE], async (principal) => {
    const { id } = await params;
    const me = principal.userId;

    const conversation = await prisma.conversation.findFirst({
      where: { id },
      select: {
        id: true,
        type: true,
        name: true,
        description: true,
        members: { select: { userId: true, user: { select: { id: true, name: true, avatarUrl: true, designation: true } } } },
      },
    });
    if (!conversation) return errorResponse(404, 'NOT_FOUND', 'Conversation not found');

    // Channels are open to the org; a DM is private to its two members.
    if (conversation.type === 'DIRECT' && !conversation.members.some((m) => m.userId === me)) {
      return errorResponse(403, 'INSUFFICIENT_PERMISSION', 'Not a member of this conversation');
    }

    const messages = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
      take: 200,
      select: AUTHOR_SELECT,
    });

    await markConversationRead(id, me);

    const other =
      conversation.type === 'DIRECT'
        ? (conversation.members.find((m) => m.userId !== me)?.user ?? conversation.members[0]?.user ?? null)
        : null;

    return successResponse({
      conversation: {
        id: conversation.id,
        type: conversation.type,
        name: conversation.name,
        description: conversation.description,
        user: other,
      },
      messages: messages.map(presentMessage),
    });
  });
}
