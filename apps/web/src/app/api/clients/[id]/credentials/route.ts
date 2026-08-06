import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { CREDENTIAL_CATEGORIES, CREDENTIAL_INCLUDE, presentCredential } from '@/lib/server/credential-present';
import { encryptSecret } from '@/lib/server/crypto';
import { errorResponse, successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.CREDENTIAL_READ], async () => {
    const { id: clientId } = await params;

    const client = await prisma.client.findFirst({ where: { id: clientId } });
    if (!client) return errorResponse(404, 'NOT_FOUND', 'Client not found');

    const credentials = await prisma.clientCredential.findMany({
      where: { clientId },
      include: CREDENTIAL_INCLUDE,
      orderBy: { service: 'asc' },
    });

    return successResponse(credentials.map((credential) => presentCredential(credential)));
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.CREDENTIAL_MANAGE], async (principal) => {
    const { id: clientId } = await params;

    const client = await prisma.client.findFirst({ where: { id: clientId } });
    if (!client) return errorResponse(404, 'NOT_FOUND', 'Client not found');

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

    const service = typeof body.service === 'string' ? body.service.trim() : '';
    if (!service) return errorResponse(400, 'VALIDATION_ERROR', 'service is required');

    const secret = typeof body.secret === 'string' ? body.secret : '';
    if (!secret) return errorResponse(400, 'VALIDATION_ERROR', 'secret is required');

    const category =
      typeof body.category === 'string' && (CREDENTIAL_CATEGORIES as readonly string[]).includes(body.category)
        ? body.category
        : null;

    const created = await prisma.clientCredential.create({
      data: {
        organizationId: principal.organizationId,
        clientId,
        service,
        category,
        loginUrl: typeof body.loginUrl === 'string' && body.loginUrl ? body.loginUrl : null,
        username: typeof body.username === 'string' && body.username ? body.username : null,
        secretCipher: encryptSecret(secret),
        notes: typeof body.notes === 'string' && body.notes ? body.notes : null,
        createdById: principal.userId,
      },
      include: CREDENTIAL_INCLUDE,
    });

    return successResponse(presentCredential(created));
  });
}
