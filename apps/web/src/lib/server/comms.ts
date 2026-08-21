import { prisma } from '@/lib/server/db';

/** A message shaped for the client. */
export function presentMessage(message: {
  id: string;
  body: string;
  createdAt: Date;
  authorId: string | null;
  author: { id: string; name: string; avatarUrl: string | null } | null;
}) {
  return {
    id: message.id,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
    author: message.author
      ? { id: message.author.id, name: message.author.name, avatarUrl: message.author.avatarUrl }
      : null,
  };
}

/**
 * Unread counts for a set of conversations, for one user. A message counts as
 * unread when it's newer than the user's last-read marker for that
 * conversation (or the user has no marker yet) and it isn't their own.
 * Channels are org-public, so a missing membership row simply means
 * "everything is unread until first opened".
 */
export async function unreadByConversation(
  conversationIds: string[],
  userId: string,
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (conversationIds.length === 0) return result;

  const memberships = await prisma.conversationMember.findMany({
    where: { userId, conversationId: { in: conversationIds } },
    select: { conversationId: true, lastReadAt: true },
  });
  const lastRead = new Map(memberships.map((m) => [m.conversationId, m.lastReadAt]));

  await Promise.all(
    conversationIds.map(async (conversationId) => {
      const count = await prisma.message.count({
        where: {
          conversationId,
          authorId: { not: userId },
          ...(lastRead.get(conversationId)
            ? { createdAt: { gt: lastRead.get(conversationId) as Date } }
            : {}),
        },
      });
      result.set(conversationId, count);
    }),
  );

  return result;
}

/** Marks a conversation read for a user (upserting the membership marker). */
export async function markConversationRead(conversationId: string, userId: string): Promise<void> {
  await prisma.conversationMember.upsert({
    where: { conversationId_userId: { conversationId, userId } },
    update: { lastReadAt: new Date() },
    create: { conversationId, userId, lastReadAt: new Date() },
  });
}
