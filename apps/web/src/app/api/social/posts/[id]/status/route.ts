import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';
import { presentSocialPost, SOCIAL_POST_INCLUDE } from '@/lib/server/social-present';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

/**
 * Routine authoring moves (idea → draft → pending approval → approved →
 * scheduled, plus marking a failure) need POST_MANAGE — the same authority
 * that creates and edits a post. Actually recording that a post went out
 * needs POST_PUBLISH instead, mirroring the routine/decision split used for
 * quotations and contracts elsewhere in this codebase.
 */
const ROUTINE: Record<string, string[]> = {
  DRAFT: ['IDEA'],
  PENDING_APPROVAL: ['DRAFT'],
  APPROVED: ['PENDING_APPROVAL'],
  SCHEDULED: ['APPROVED', 'DRAFT'],
  FAILED: ['SCHEDULED'],
};
const DECISION: Record<string, string[]> = {
  PUBLISHED: ['SCHEDULED', 'APPROVED'],
};

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.POST_READ], async (principal) => {
    const { id } = await params;

    let body: { status?: unknown };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const status = typeof body.status === 'string' ? body.status : '';
    const fromStatuses = ROUTINE[status] ?? DECISION[status];
    if (!fromStatuses) {
      return errorResponse(
        400,
        'VALIDATION_ERROR',
        `status must be one of: ${[...Object.keys(ROUTINE), ...Object.keys(DECISION)].join(', ')}`,
      );
    }

    const requiredPermission = status in DECISION ? PERMISSIONS.POST_PUBLISH : PERMISSIONS.POST_MANAGE;
    if (!principal.permissions.includes(requiredPermission)) {
      return errorResponse(403, 'INSUFFICIENT_PERMISSION', `Missing required permission: ${requiredPermission}`);
    }

    const post = await prisma.socialPost.findFirst({ where: { id } });
    if (!post) return errorResponse(404, 'NOT_FOUND', 'Post not found');

    if (!fromStatuses.includes(post.status)) {
      return errorResponse(
        400,
        'VALIDATION_ERROR',
        `Cannot move a ${post.status.toLowerCase().replace('_', ' ')} post to ${status.toLowerCase().replace('_', ' ')}`,
      );
    }

    const updated = await prisma.socialPost.update({
      where: { id },
      data: {
        status: status as never,
        ...(status === 'PUBLISHED' ? { publishedAt: new Date() } : {}),
      },
      include: SOCIAL_POST_INCLUDE,
    });

    return successResponse(presentSocialPost(updated));
  });
}
