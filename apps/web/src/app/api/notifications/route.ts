import type { NextRequest } from 'next/server';

import { prisma } from '@/lib/server/db';
import { paginatedResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

/**
 * The caller's own notifications, newest first.
 *
 * Always scoped to the authenticated user — a notification is addressed to a
 * person, so there is no permission that would let one user read another's.
 * `meta.unread` backs the header badge, which polls this endpoint.
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

    const [notifications, total, unread] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId: principal.userId, readAt: null } }),
    ]);

    return paginatedResponse(
      notifications.map((notification) => ({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        link: notification.link,
        severity: notification.severity,
        readAt: notification.readAt?.toISOString() ?? null,
        createdAt: notification.createdAt.toISOString(),
      })),
      { limit, total, unread },
    );
  });
}

/** Marks notifications read — all of the caller's, or just the listed ids. */
export async function PATCH(req: NextRequest) {
  return withAuth(req, [], async (principal) => {
    let body: { ids?: unknown } = {};
    try {
      body = await req.json();
    } catch {
      // An empty body means "mark everything read".
    }

    const ids = Array.isArray(body.ids)
      ? body.ids.filter((id): id is string => typeof id === 'string')
      : null;

    const result = await prisma.notification.updateMany({
      where: {
        userId: principal.userId,
        readAt: null,
        ...(ids ? { id: { in: ids } } : {}),
      },
      data: { readAt: new Date() },
    });

    // Recounted rather than assumed zero: marking a subset read leaves the
    // rest unread, and the badge reads this number.
    const unread = await prisma.notification.count({
      where: { userId: principal.userId, readAt: null },
    });

    return paginatedResponse({ updated: result.count }, { unread });
  });
}
