import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { ASSET_INCLUDE, ASSET_TYPES, presentAsset } from '@/lib/server/asset-present';
import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.ASSET_READ], async () => {
    const { id: clientId } = await params;

    const client = await prisma.client.findFirst({ where: { id: clientId } });
    if (!client) return errorResponse(404, 'NOT_FOUND', 'Client not found');

    const assets = await prisma.asset.findMany({
      where: { clientId },
      include: ASSET_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    return successResponse(assets.map((asset) => presentAsset(asset)));
  });
}

/**
 * Records a link to a client brand asset. There is no file-storage
 * integration in this app (every other "file" field in this codebase —
 * resumes, submissions, contracts — is a pasted URL, not an upload), so
 * fileKey/sizeBytes are placeholders rather than real object-storage
 * metadata.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.ASSET_CREATE], async (principal) => {
    const { id: clientId } = await params;

    const client = await prisma.client.findFirst({ where: { id: clientId } });
    if (!client) return errorResponse(404, 'NOT_FOUND', 'Client not found');

    let body: { name?: unknown; fileUrl?: unknown; mimeType?: unknown; tags?: unknown };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const fileUrl = typeof body.fileUrl === 'string' ? body.fileUrl.trim() : '';
    if (!name || !fileUrl) return errorResponse(400, 'VALIDATION_ERROR', 'name and fileUrl are required');

    const mimeType =
      typeof body.mimeType === 'string' && (ASSET_TYPES as readonly string[]).includes(body.mimeType)
        ? body.mimeType
        : 'OTHER';

    const created = await prisma.asset.create({
      data: {
        organizationId: principal.organizationId,
        name,
        clientId,
        fileKey: fileUrl,
        fileUrl,
        mimeType,
        sizeBytes: 0,
        tags: Array.isArray(body.tags) ? body.tags.filter((t): t is string => typeof t === 'string') : [],
        uploadedById: principal.userId,
      },
      include: ASSET_INCLUDE,
    });

    return successResponse(presentAsset(created));
  });
}
