import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import type { AuthPrincipal } from '@/lib/server/auth';
import { presentCapiConfig } from '@/lib/server/capi-service';
import { clientVisibilityFilter } from '@/lib/server/clients-present';
import { encryptSecret } from '@/lib/server/crypto';
import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

async function findClient(id: string, principal: AuthPrincipal) {
  return prisma.client.findFirst({
    where: { id, ...clientVisibilityFilter(principal) },
    select: { id: true },
  });
}

/** The client's Meta Conversions API config (token never returned in plaintext). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.CLIENT_READ], async (principal) => {
    const { id } = await params;
    const client = await findClient(id, principal);
    if (!client) return errorResponse(404, 'NOT_FOUND', 'Client not found');

    const config = await prisma.metaCapiConfig.findFirst({ where: { clientId: id } });
    return successResponse(config ? presentCapiConfig(config) : null);
  });
}

/** Creates or updates the config. A blank accessToken on update keeps the stored one. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.CAPI_MANAGE], async (principal) => {
    const { id } = await params;
    const client = await findClient(id, principal);
    if (!client) return errorResponse(404, 'NOT_FOUND', 'Client not found');

    let body: {
      pixelId?: unknown;
      datasetId?: unknown;
      accessToken?: unknown;
      testEventCode?: unknown;
      defaultEventName?: unknown;
      isActive?: unknown;
    };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const pixelId = typeof body.pixelId === 'string' ? body.pixelId.trim() : '';
    if (!pixelId) return errorResponse(400, 'VALIDATION_ERROR', 'pixelId is required');

    const existing = await prisma.metaCapiConfig.findFirst({ where: { clientId: id } });

    const accessToken = typeof body.accessToken === 'string' ? body.accessToken.trim() : '';
    if (!existing && !accessToken) {
      return errorResponse(400, 'VALIDATION_ERROR', 'accessToken is required');
    }

    const datasetId =
      typeof body.datasetId === 'string' && body.datasetId.trim() ? body.datasetId.trim() : null;
    const testEventCode =
      typeof body.testEventCode === 'string' && body.testEventCode.trim() ? body.testEventCode.trim() : null;
    const defaultEventName =
      typeof body.defaultEventName === 'string' && body.defaultEventName.trim()
        ? body.defaultEventName.trim()
        : 'Lead';
    const isActive = body.isActive === undefined ? true : Boolean(body.isActive);

    const data = {
      pixelId,
      datasetId,
      testEventCode,
      defaultEventName,
      isActive,
      ...(accessToken ? { accessTokenCipher: encryptSecret(accessToken) } : {}),
    };

    let configId: string;
    if (existing) {
      const updated = await prisma.metaCapiConfig.update({ where: { id: existing.id }, data, select: { id: true } });
      configId = updated.id;
    } else {
      const created = await prisma.metaCapiConfig.create({
        data: {
          organizationId: principal.organizationId,
          clientId: id,
          createdById: principal.userId,
          accessTokenCipher: encryptSecret(accessToken),
          ...data,
        },
        select: { id: true },
      });
      configId = created.id;
    }

    const fresh = await prisma.metaCapiConfig.findFirstOrThrow({ where: { id: configId } });
    return successResponse(presentCapiConfig(fresh));
  });
}

/** Removes the config entirely — events already logged are preserved. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.CAPI_MANAGE], async (principal) => {
    const { id } = await params;
    const client = await findClient(id, principal);
    if (!client) return errorResponse(404, 'NOT_FOUND', 'Client not found');

    const existing = await prisma.metaCapiConfig.findFirst({ where: { clientId: id }, select: { id: true } });
    if (!existing) return errorResponse(404, 'NOT_FOUND', 'No config to remove');

    await prisma.metaCapiConfig.delete({ where: { id: existing.id } });
    return successResponse({ removed: true });
  });
}
