import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { presentCapiEvent } from '@/lib/server/capi-service';
import { clientVisibilityFilter } from '@/lib/server/clients-present';
import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

/** The client's conversion dispatch log — most recent first. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.CLIENT_READ], async (principal) => {
    const { id } = await params;

    const client = await prisma.client.findFirst({
      where: { id, ...clientVisibilityFilter(principal) },
      select: { id: true },
    });
    if (!client) return errorResponse(404, 'NOT_FOUND', 'Client not found');

    const take = Math.min(Number(req.nextUrl.searchParams.get('take')) || 20, 100);
    const events = await prisma.capiEvent.findMany({
      where: { clientId: id },
      orderBy: { createdAt: 'desc' },
      take,
    });

    return successResponse(events.map(presentCapiEvent));
  });
}
