import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { CREDENTIAL_CATEGORIES, CREDENTIAL_INCLUDE, presentCredential } from '@/lib/server/credential-present';
import { encryptSecret } from '@/lib/server/crypto';
import { errorResponse, successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; credentialId: string }> },
) {
  return withAuth(req, [PERMISSIONS.CREDENTIAL_MANAGE], async () => {
    const { id: clientId, credentialId } = await params;

    const credential = await prisma.clientCredential.findFirst({ where: { id: credentialId, clientId } });
    if (!credential) return errorResponse(404, 'NOT_FOUND', 'Credential not found');

    let body: {
      service?: unknown;
      category?: unknown;
      loginUrl?: unknown;
      username?: unknown;
      secret?: unknown;
      notes?: unknown;
    };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const data: Record<string, unknown> = {};
    if (typeof body.service === 'string' && body.service.trim()) data.service = body.service.trim();
    if (body.category !== undefined) {
      data.category =
        typeof body.category === 'string' && (CREDENTIAL_CATEGORIES as readonly string[]).includes(body.category)
          ? body.category
          : null;
    }
    if (body.loginUrl !== undefined) data.loginUrl = typeof body.loginUrl === 'string' && body.loginUrl ? body.loginUrl : null;
    if (body.username !== undefined) data.username = typeof body.username === 'string' && body.username ? body.username : null;
    if (body.notes !== undefined) data.notes = typeof body.notes === 'string' && body.notes ? body.notes : null;
    if (typeof body.secret === 'string' && body.secret) data.secretCipher = encryptSecret(body.secret);

    const updated = await prisma.clientCredential.update({
      where: { id: credentialId },
      data,
      include: CREDENTIAL_INCLUDE,
    });

    return successResponse(presentCredential(updated));
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; credentialId: string }> },
) {
  return withAuth(req, [PERMISSIONS.CREDENTIAL_MANAGE], async () => {
    const { id: clientId, credentialId } = await params;

    const credential = await prisma.clientCredential.findFirst({ where: { id: credentialId, clientId } });
    if (!credential) return errorResponse(404, 'NOT_FOUND', 'Credential not found');

    await prisma.clientCredential.delete({ where: { id: credentialId } });
    return successResponse({ id: credentialId });
  });
}
