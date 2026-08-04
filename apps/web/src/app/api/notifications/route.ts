import type { NextRequest } from 'next/server';

import { prisma } from '@/lib/server/db';
import { paginatedResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

/**
 * The signed-in user's notifications, newest first.
 *
 * The app shell polls this for its unread badge on mount and every minute
 * thereafter. Until now the route did not exist, so each of those polls cost
 * a round trip that returned Next's HTML 404 page and then threw in the
 * client's `response.json()` — a guaranteed failure on every page load.
 *
 * No permission is required beyond being authenticated: these are the
 * caller's own notifications, and the query is pinned to `principal.userId`
 * rather than to anything supplied by the request.
 */
export async function GET(req: NextRequest) {
  return withAuth(req, [], async (principal) => {
    const params = req.nextUrl.searchParams;
    const limit = Math.min(Math.max(Number(params.get('limit')) || 20, 1), 100);
    const unreadOnly = params.get('unread') === 'true';

    const where = {
      userId: principal.userId,
      ...(unreadOnly ? { readAt: null } : {}),
    };

    const [notifications, unread] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          link: true,
          severity: true,
          readAt: true,
          createdAt: true,
        },
      }),
      prisma.notification.count({ where: { userId: principal.userId, readAt: null } }),
    ]);

    return paginatedResponse(
      notifications.map((notification) => ({
        ...notification,
        readAt: notification.readAt?.toISOString() ?? null,
        createdAt: notification.createdAt.toISOString(),
      })),
      { unread, limit },
    );
  });
}

/** Marks every unread notification as read. */
export async function PATCH(req: NextRequest) {
  return withAuth(req, [], async (principal) => {
    const result = await prisma.notification.updateMany({
      where: { userId: principal.userId, readAt: null },
      data: { readAt: new Date() },
    });

    return paginatedResponse([], { marked: result.count, unread: 0 });
  });
}
