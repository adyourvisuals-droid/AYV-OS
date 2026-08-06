import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';
import { presentCampaign } from '@/lib/server/social-present';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.CAMPAIGN_READ], async () => {
    const limit = Math.min(Number(req.nextUrl.searchParams.get('limit')) || 100, 200);

    const campaigns = await prisma.campaign.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return successResponse(campaigns.map((campaign) => presentCampaign(campaign)));
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.CAMPAIGN_MANAGE], async (principal) => {
    let body: { name?: unknown; clientId?: unknown; platform?: unknown; objective?: unknown };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return errorResponse(400, 'VALIDATION_ERROR', 'name is required');

    const created = await prisma.campaign.create({
      data: {
        organizationId: principal.organizationId,
        name,
        clientId: typeof body.clientId === 'string' && body.clientId ? body.clientId : null,
        platform: typeof body.platform === 'string' ? body.platform : null,
        objective: typeof body.objective === 'string' ? body.objective : null,
      },
    });

    return successResponse(presentCampaign(created));
  });
}
