import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

const SELECT = {
  id: true,
  body: true,
  createdAt: true,
  author: { select: { id: true, name: true, avatarUrl: true } },
} as const;

function present(c: {
  id: string;
  body: string;
  createdAt: Date;
  author: { id: string; name: string; avatarUrl: string | null } | null;
}) {
  return { id: c.id, body: c.body, createdAt: c.createdAt.toISOString(), author: c.author };
}

/** The comment thread under one announcement. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.COMM_USE], async () => {
    const { id } = await params;
    const comments = await prisma.announcementComment.findMany({
      where: { announcementId: id },
      orderBy: { createdAt: 'asc' },
      take: 200,
      select: SELECT,
    });
    return successResponse(comments.map(present));
  });
}

/** Adds a comment to an announcement. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.COMM_USE], async (principal) => {
    const { id } = await params;

    const announcement = await prisma.announcement.findFirst({ where: { id }, select: { id: true } });
    if (!announcement) return errorResponse(404, 'NOT_FOUND', 'Announcement not found');

    let body: { body?: unknown };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const text = typeof body.body === 'string' ? body.body.trim() : '';
    if (!text) return errorResponse(400, 'VALIDATION_ERROR', 'A comment is required');

    const { id: commentId } = await prisma.announcementComment.create({
      data: { announcementId: id, authorId: principal.userId, body: text },
      select: { id: true },
    });

    const created = await prisma.announcementComment.findFirstOrThrow({ where: { id: commentId }, select: SELECT });
    return successResponse(present(created));
  });
}
