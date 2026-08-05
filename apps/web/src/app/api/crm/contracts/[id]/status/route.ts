import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { CONTRACT_INCLUDE, presentContract } from '@/lib/server/contracts-present';
import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';
import { scopeFilter } from '@/lib/server/scope';

export const runtime = 'nodejs';

/**
 * Same split as the quotation status endpoint: routine transitions need the
 * authority that drafts a contract (CONTRACT_CREATE — there's no separate
 * UPDATE permission), recording that it was actually signed needs
 * CONTRACT_APPROVE. In this registry only CEO holds APPROVE, so signing off
 * a contract is deliberately a tighter gate than sending one for signature.
 */
const ROUTINE: Record<string, string[]> = {
  SENT: ['DRAFT'],
  EXPIRED: ['SIGNED'],
};
const DECISION: Record<string, string[]> = {
  SIGNED: ['SENT'],
  TERMINATED: ['SIGNED'],
};

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.CONTRACT_READ], async (principal) => {
    const { id } = await params;

    let body: { status?: unknown; signedByName?: unknown };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const status = typeof body.status === 'string' ? body.status : '';
    const fromStatuses = ROUTINE[status] ?? DECISION[status];
    if (!fromStatuses) {
      return errorResponse(
        400,
        'VALIDATION_ERROR',
        `status must be one of: ${[...Object.keys(ROUTINE), ...Object.keys(DECISION)].join(', ')}`,
      );
    }

    const requiredPermission = status in DECISION ? PERMISSIONS.CONTRACT_APPROVE : PERMISSIONS.CONTRACT_CREATE;
    if (!principal.permissions.includes(requiredPermission)) {
      return errorResponse(403, 'INSUFFICIENT_PERMISSION', `Missing required permission: ${requiredPermission}`);
    }

    if (status === 'SIGNED' && (typeof body.signedByName !== 'string' || !body.signedByName.trim())) {
      return errorResponse(400, 'VALIDATION_ERROR', 'signedByName is required to record a signature');
    }

    const contract = await prisma.contract.findFirst({
      where: {
        id,
        ...scopeFilter(principal, PERMISSIONS.CONTRACT_READ, { ownerField: 'createdById' }),
      },
    });
    if (!contract) return errorResponse(404, 'NOT_FOUND', 'Contract not found');

    if (!fromStatuses.includes(contract.status)) {
      return errorResponse(
        400,
        'VALIDATION_ERROR',
        `Cannot move a ${contract.status.toLowerCase()} contract to ${status.toLowerCase()}`,
      );
    }

    const updated = await prisma.contract.update({
      where: { id },
      data: {
        status,
        ...(status === 'SIGNED'
          ? { signedAt: new Date(), signedByName: (body.signedByName as string).trim() }
          : {}),
      },
      include: CONTRACT_INCLUDE,
    });

    if (status === 'SENT' && (contract.leadId || contract.clientId)) {
      await prisma.activity.create({
        data: {
          organizationId: principal.organizationId,
          type: 'CONTRACT_SENT',
          leadId: contract.leadId,
          clientId: contract.clientId,
          actorId: principal.userId,
          title: `Contract ${contract.number} sent`,
          body: `₹${Number(contract.value).toLocaleString('en-IN')}`,
        },
      });
    }

    return successResponse(presentContract(updated));
  });
}
