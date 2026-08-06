import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';
import { presentSocialPost, SOCIAL_PLATFORMS, SOCIAL_POST_INCLUDE } from '@/lib/server/social-present';
import { withAuth } from '@/lib/server/require-auth';
import { scopeFilter } from '@/lib/server/scope';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.POST_READ], async (principal) => {
    const { id } = await params;

    const post = await prisma.socialPost.findFirst({
      where: { id, ...scopeFilter(principal, PERMISSIONS.POST_READ, { ownerField: 'authorId' }) },
      include: SOCIAL_POST_INCLUDE,
    });
    if (!post) return errorResponse(404, 'NOT_FOUND', 'Post not found');

    return successResponse(presentSocialPost(post));
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.POST_MANAGE], async () => {
    const { id } = await params;

    const post = await prisma.socialPost.findFirst({ where: { id } });
    if (!post) return errorResponse(404, 'NOT_FOUND', 'Post not found');
    if (post.status === 'PUBLISHED') {
      return errorResponse(400, 'VALIDATION_ERROR', 'A published post cannot be edited');
    }

    let body: {
      clientId?: unknown;
      campaignId?: unknown;
      platforms?: unknown;
      caption?: unknown;
      hashtags?: unknown;
      mediaUrls?: unknown;
      scheduledAt?: unknown;
    };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const data: Record<string, unknown> = {};
    if (body.clientId !== undefined) data.clientId = typeof body.clientId === 'string' && body.clientId ? body.clientId : null;
    if (body.campaignId !== undefined) data.campaignId = typeof body.campaignId === 'string' && body.campaignId ? body.campaignId : null;
    if (body.platforms !== undefined) {
      const platforms = Array.isArray(body.platforms)
        ? body.platforms.filter((p): p is string => typeof p === 'string' && (SOCIAL_PLATFORMS as readonly string[]).includes(p))
        : [];
      if (platforms.length === 0) {
        return errorResponse(400, 'VALIDATION_ERROR', `platforms must include at least one of: ${SOCIAL_PLATFORMS.join(', ')}`);
      }
      data.platforms = platforms;
    }
    if (body.caption !== undefined) data.caption = typeof body.caption === 'string' ? body.caption : null;
    if (body.hashtags !== undefined) {
      data.hashtags = Array.isArray(body.hashtags) ? body.hashtags.filter((h): h is string => typeof h === 'string') : [];
    }
    if (body.mediaUrls !== undefined) {
      data.mediaUrls = Array.isArray(body.mediaUrls) ? body.mediaUrls.filter((m): m is string => typeof m === 'string') : [];
    }
    if (body.scheduledAt !== undefined) {
      data.scheduledAt =
        body.scheduledAt === null
          ? null
          : typeof body.scheduledAt === 'string' && !Number.isNaN(Date.parse(body.scheduledAt))
            ? new Date(body.scheduledAt)
            : undefined;
      if (data.scheduledAt === undefined) delete data.scheduledAt;
    }

    const updated = await prisma.socialPost.update({ where: { id }, data, include: SOCIAL_POST_INCLUDE });
    return successResponse(presentSocialPost(updated));
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.POST_MANAGE], async () => {
    const { id } = await params;

    const post = await prisma.socialPost.findFirst({ where: { id } });
    if (!post) return errorResponse(404, 'NOT_FOUND', 'Post not found');

    await prisma.socialPost.delete({ where: { id } });
    return successResponse({ id });
  });
}
