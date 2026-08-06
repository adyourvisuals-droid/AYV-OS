import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';
import {
  POST_STATUSES,
  presentSocialPost,
  SOCIAL_PLATFORMS,
  SOCIAL_POST_INCLUDE,
} from '@/lib/server/social-present';
import { withAuth } from '@/lib/server/require-auth';
import { scopeFilter } from '@/lib/server/scope';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.POST_READ], async (principal) => {
    const query = req.nextUrl.searchParams;
    const status = query.get('status');
    const clientId = query.get('clientId');
    const campaignId = query.get('campaignId');
    const from = query.get('from');
    const to = query.get('to');
    const limit = Math.min(Number(query.get('limit')) || 200, 500);

    if (status && !(POST_STATUSES as readonly string[]).includes(status)) {
      return errorResponse(400, 'VALIDATION_ERROR', `status must be one of: ${POST_STATUSES.join(', ')}`);
    }

    const scheduledAt: Record<string, Date> = {};
    if (from && !Number.isNaN(Date.parse(from))) scheduledAt.gte = new Date(from);
    if (to && !Number.isNaN(Date.parse(to))) scheduledAt.lte = new Date(to);

    const posts = await prisma.socialPost.findMany({
      where: {
        ...scopeFilter(principal, PERMISSIONS.POST_READ, { ownerField: 'authorId' }),
        ...(status ? { status: status as never } : {}),
        ...(clientId ? { clientId } : {}),
        ...(campaignId ? { campaignId } : {}),
        // Unscheduled ideas have no scheduledAt at all — a plain range filter
        // would silently exclude them (Prisma treats gte/lte as NULL-excluding),
        // so a date range widens to "in range OR still unscheduled" instead.
        ...(Object.keys(scheduledAt).length > 0 ? { OR: [{ scheduledAt: null }, { scheduledAt }] } : {}),
      },
      include: SOCIAL_POST_INCLUDE,
      orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'desc' }],
      take: limit,
    });

    return successResponse(posts.map((post) => presentSocialPost(post)));
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.POST_MANAGE], async (principal) => {
    let body: {
      clientId?: unknown;
      campaignId?: unknown;
      platforms?: unknown;
      caption?: unknown;
      hashtags?: unknown;
      mediaUrls?: unknown;
      scheduledAt?: unknown;
      status?: unknown;
    };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const platforms = Array.isArray(body.platforms)
      ? body.platforms.filter((p): p is string => typeof p === 'string' && (SOCIAL_PLATFORMS as readonly string[]).includes(p))
      : [];
    if (platforms.length === 0) {
      return errorResponse(400, 'VALIDATION_ERROR', `platforms must include at least one of: ${SOCIAL_PLATFORMS.join(', ')}`);
    }

    const status = typeof body.status === 'string' && (POST_STATUSES as readonly string[]).includes(body.status)
      ? body.status
      : 'IDEA';

    const scheduledAt =
      typeof body.scheduledAt === 'string' && !Number.isNaN(Date.parse(body.scheduledAt))
        ? new Date(body.scheduledAt)
        : null;

    const created = await prisma.socialPost.create({
      data: {
        organizationId: principal.organizationId,
        authorId: principal.userId,
        clientId: typeof body.clientId === 'string' && body.clientId ? body.clientId : null,
        campaignId: typeof body.campaignId === 'string' && body.campaignId ? body.campaignId : null,
        platforms: platforms as never,
        caption: typeof body.caption === 'string' ? body.caption : null,
        hashtags: Array.isArray(body.hashtags) ? body.hashtags.filter((h): h is string => typeof h === 'string') : [],
        mediaUrls: Array.isArray(body.mediaUrls) ? body.mediaUrls.filter((m): m is string => typeof m === 'string') : [],
        status: status as never,
        scheduledAt,
      },
      include: SOCIAL_POST_INCLUDE,
    });

    return successResponse(presentSocialPost(created));
  });
}
