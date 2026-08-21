import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { unreadByConversation } from '@/lib/server/comms';
import { prisma } from '@/lib/server/db';
import { successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

/** The comms sidebar: every team channel, my direct threads, and unread counts. */
export async function GET(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.COMM_USE], async (principal) => {
    const me = principal.userId;

    const [channels, dms] = await Promise.all([
      // Channels are org-public — everyone sees every team channel.
      prisma.conversation.findMany({
        where: { type: 'CHANNEL' },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, description: true, lastMessageAt: true },
      }),
      prisma.conversation.findMany({
        where: { type: 'DIRECT', members: { some: { userId: me } } },
        orderBy: { lastMessageAt: 'desc' },
        select: {
          id: true,
          lastMessageAt: true,
          members: { select: { user: { select: { id: true, name: true, avatarUrl: true, designation: true } } } },
        },
      }),
    ]);

    const unread = await unreadByConversation(
      [...channels.map((c) => c.id), ...dms.map((d) => d.id)],
      me,
    );

    const channelList = channels.map((channel) => ({
      id: channel.id,
      name: channel.name,
      description: channel.description,
      lastMessageAt: channel.lastMessageAt?.toISOString() ?? null,
      unread: unread.get(channel.id) ?? 0,
    }));

    const dmList = dms.map((dm) => {
      const other = dm.members.find((m) => m.user.id !== me)?.user ?? dm.members[0]?.user ?? null;
      return {
        id: dm.id,
        user: other,
        lastMessageAt: dm.lastMessageAt?.toISOString() ?? null,
        unread: unread.get(dm.id) ?? 0,
      };
    });

    const unreadTotal = [...unread.values()].reduce((sum, n) => sum + n, 0);

    return successResponse({ channels: channelList, dms: dmList, unreadTotal });
  });
}
