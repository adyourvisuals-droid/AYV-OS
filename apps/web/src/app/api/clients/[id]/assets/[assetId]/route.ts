import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; assetId: string }> }) {
  return withAuth(req, [PERMISSIONS.ASSET_DELETE], async () => {
    const { id: clientId, assetId } = await params;

    const asset = await prisma.asset.findFirst({ where: { id: assetId, clientId } });
    if (!asset) return errorResponse(404, 'NOT_FOUND', 'Asset not found');

    await prisma.asset.delete({ where: { id: assetId } });
    return successResponse({ id: assetId });
  });
}
