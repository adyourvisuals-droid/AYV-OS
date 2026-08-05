import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';
import { presentQuotation, QUOTATION_INCLUDE } from '@/lib/server/quotations-present';
import { withAuth } from '@/lib/server/require-auth';
import { scopeFilter } from '@/lib/server/scope';

export const runtime = 'nodejs';

/**
 * Routine transitions (send, expire) need QUOTATION_UPDATE — the same
 * authority that lets someone edit their own draft. Recording the client's
 * decision (accepted/rejected) needs QUOTATION_APPROVE instead, matching
 * how EXPENSE_APPROVE/INVOICE_APPROVE gate "who finalizes the outcome"
 * elsewhere in this codebase, not "who did the routine work".
 */
const ROUTINE: Record<string, string[]> = {
  SENT: ['DRAFT'],
  EXPIRED: ['SENT'],
};
const DECISION: Record<string, string[]> = {
  ACCEPTED: ['SENT'],
  REJECTED: ['SENT'],
};

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Gated on read here; the two permissions that actually authorise a
  // transition (UPDATE for routine moves, APPROVE for recording a decision)
  // are not held together by every role that needs one of them — CEO has
  // APPROVE but not UPDATE — so each is checked per-transition below instead.
  return withAuth(req, [PERMISSIONS.QUOTATION_READ], async (principal) => {
    const { id } = await params;

    let body: { status?: unknown };
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

    const requiredPermission = status in DECISION ? PERMISSIONS.QUOTATION_APPROVE : PERMISSIONS.QUOTATION_UPDATE;
    if (!principal.permissions.includes(requiredPermission)) {
      return errorResponse(403, 'INSUFFICIENT_PERMISSION', `Missing required permission: ${requiredPermission}`);
    }

    const quotation = await prisma.quotation.findFirst({
      where: {
        id,
        ...scopeFilter(principal, PERMISSIONS.QUOTATION_READ, { ownerField: 'createdById' }),
      },
    });
    if (!quotation) return errorResponse(404, 'NOT_FOUND', 'Quotation not found');

    if (!fromStatuses.includes(quotation.status)) {
      return errorResponse(
        400,
        'VALIDATION_ERROR',
        `Cannot move a ${quotation.status.toLowerCase()} quotation to ${status.toLowerCase()}`,
      );
    }

    const updated = await prisma.quotation.update({
      where: { id },
      data: {
        status,
        ...(status === 'SENT' && !quotation.sentAt ? { sentAt: new Date() } : {}),
      },
      include: QUOTATION_INCLUDE,
    });

    if (status === 'SENT' && (quotation.leadId || quotation.clientId)) {
      await prisma.activity.create({
        data: {
          organizationId: principal.organizationId,
          type: 'QUOTATION_SENT',
          leadId: quotation.leadId,
          clientId: quotation.clientId,
          actorId: principal.userId,
          title: `Quotation ${quotation.number} sent`,
          body: `₹${Number(updated.total).toLocaleString('en-IN')}`,
        },
      });
    }

    return successResponse(presentQuotation(updated));
  });
}
