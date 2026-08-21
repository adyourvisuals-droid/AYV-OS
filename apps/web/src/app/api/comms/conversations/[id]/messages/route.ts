import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { markConversationRead, presentMessage } from '@/lib/server/comms';
import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

/** Posts a message. Bumps the conversation's activity time and marks it read for the sender. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.COMM_USE], async (principal) => {
    const { id } = await params;
    const me = principal.userId;

    const conversation = await prisma.conversation.findFirst({
      where: { id },
      select: { id: true, type: true, members: { select: { userId: true } } },
    });
    if (!conversation) return errorResponse(404, 'NOT_FOUND', 'Conversation not found');
    if (conversation.type === 'DIRECT' && !conversation.members.some((m) => m.userId === me)) {
      return errorResponse(403, 'INSUFFICIENT_PERMISSION', 'Not a member of this conversation');
    }

    let body: { body?: unknown };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const text = typeof body.body === 'string' ? body.body.trim() : '';
    if (!text) return errorResponse(400, 'VALIDATION_ERROR', 'Message body is required');
    if (text.length > 4000) return errorResponse(400, 'VALIDATION_ERROR', 'Message is too long');

    const { id: messageId } = await prisma.message.create({
      data: { conversationId: id, authorId: me, body: text },
      select: { id: true },
    });

    await Promise.all([
      prisma.conversation.update({ where: { id }, data: { lastMessageAt: new Date() } }),
      markConversationRead(id, me),
    ]);

    const message = await prisma.message.findFirstOrThrow({
      where: { id: messageId },
      select: {
        id: true,
        body: true,
        createdAt: true,
        authorId: true,
        author: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    return successResponse(presentMessage(message));
  });
}
