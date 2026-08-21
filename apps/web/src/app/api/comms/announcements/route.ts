import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

function present(a: {
  id: string;
  title: string;
  body: string;
  isPinned: boolean;
  createdAt: Date;
  author: { id: string; name: string; avatarUrl: string | null } | null;
  _count: { comments: number };
}) {
  return {
    id: a.id,
    title: a.title,
    body: a.body,
    isPinned: a.isPinned,
    createdAt: a.createdAt.toISOString(),
    author: a.author,
    commentCount: a._count.comments,
  };
}

/** The announcements feed — pinned first, then newest. */
export async function GET(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.COMM_USE], async () => {
    const rows = await prisma.announcement.findMany({
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      take: 50,
      select: {
        id: true,
        title: true,
        body: true,
        isPinned: true,
        createdAt: true,
        author: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { comments: true } },
      },
    });
    return successResponse(rows.map(present));
  });
}

/** Posts an announcement. Pinning at creation requires the manage permission. */
export async function POST(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.COMM_USE], async (principal) => {
    let body: { title?: unknown; body?: unknown; isPinned?: unknown };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const text = typeof body.body === 'string' ? body.body.trim() : '';
    if (!title) return errorResponse(400, 'VALIDATION_ERROR', 'A title is required');
    if (!text) return errorResponse(400, 'VALIDATION_ERROR', 'A message is required');

    const canManage = principal.permissions.includes(PERMISSIONS.ANNOUNCEMENT_MANAGE);
    const isPinned = canManage && body.isPinned === true;

    const { id } = await prisma.announcement.create({
      data: {
        organizationId: principal.organizationId,
        authorId: principal.userId,
        title,
        body: text,
        isPinned,
      },
      select: { id: true },
    });

    const created = await prisma.announcement.findFirstOrThrow({
      where: { id },
      select: {
        id: true,
        title: true,
        body: true,
        isPinned: true,
        createdAt: true,
        author: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { comments: true } },
      },
    });

    return successResponse(present(created));
  });
}
