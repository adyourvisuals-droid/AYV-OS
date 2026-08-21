import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

/** Edit an announcement or toggle its pin. Author can edit text; pin needs manage. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.COMM_USE], async (principal) => {
    const { id } = await params;
    const existing = await prisma.announcement.findFirst({ where: { id }, select: { id: true, authorId: true } });
    if (!existing) return errorResponse(404, 'NOT_FOUND', 'Announcement not found');

    const canManage = principal.permissions.includes(PERMISSIONS.ANNOUNCEMENT_MANAGE);
    const isAuthor = existing.authorId === principal.userId;
    if (!canManage && !isAuthor) return errorResponse(403, 'INSUFFICIENT_PERMISSION', 'Cannot edit this announcement');

    let body: { title?: unknown; body?: unknown; isPinned?: unknown };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const data: Record<string, unknown> = {};
    if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim();
    if (typeof body.body === 'string' && body.body.trim()) data.body = body.body.trim();
    // Pinning is a leadership action, not something an author can self-serve.
    if (typeof body.isPinned === 'boolean' && canManage) data.isPinned = body.isPinned;

    if (Object.keys(data).length === 0) return errorResponse(400, 'VALIDATION_ERROR', 'Nothing to update');

    await prisma.announcement.update({ where: { id }, data });
    return successResponse({ id, updated: true });
  });
}

/** Remove an announcement. Author or a manager only. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.COMM_USE], async (principal) => {
    const { id } = await params;
    const existing = await prisma.announcement.findFirst({ where: { id }, select: { id: true, authorId: true } });
    if (!existing) return errorResponse(404, 'NOT_FOUND', 'Announcement not found');

    const canManage = principal.permissions.includes(PERMISSIONS.ANNOUNCEMENT_MANAGE);
    if (!canManage && existing.authorId !== principal.userId) {
      return errorResponse(403, 'INSUFFICIENT_PERMISSION', 'Cannot delete this announcement');
    }

    await prisma.announcement.delete({ where: { id } });
    return successResponse({ removed: true });
  });
}
