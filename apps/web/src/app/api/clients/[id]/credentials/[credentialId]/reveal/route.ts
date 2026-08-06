import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { decryptSecret } from '@/lib/server/crypto';
import { errorResponse, successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

/**
 * Decrypts and returns a credential's secret. Split out from the list/detail
 * endpoints deliberately — the secret must never ride along with a routine
 * GET, only be fetched on an explicit "reveal" click, and every reveal is
 * logged so there's a record of who looked at a client's password and when.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; credentialId: string }> },
) {
  return withAuth(req, [PERMISSIONS.CREDENTIAL_READ], async (principal) => {
    const { id: clientId, credentialId } = await params;

    const credential = await prisma.clientCredential.findFirst({ where: { id: credentialId, clientId } });
    if (!credential) return errorResponse(404, 'NOT_FOUND', 'Credential not found');

    let secret: string;
    try {
      secret = decryptSecret(credential.secretCipher);
    } catch {
      return errorResponse(500, 'INTERNAL_ERROR', 'Could not decrypt this credential');
    }

    await prisma.auditLog.create({
      data: {
        organizationId: principal.organizationId,
        actorId: principal.userId,
        action: 'REVEAL',
        entity: 'ClientCredential',
        entityId: credential.id,
      },
    });

    return successResponse({ secret });
  });
}
