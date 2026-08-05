import type { NextRequest } from 'next/server';

import { LeadStatus, PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { CLIENT_INCLUDE, presentClient } from '@/lib/server/clients-present';
import { errorResponse, successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';
import { scopeFilter } from '@/lib/server/scope';

export const runtime = 'nodejs';

/**
 * Converts a won lead into a client.
 *
 * A lead can only be converted once — convertedClientId is unique on the
 * Lead model, so the sales history that produced this account is always
 * traceable back to the deal that won it, and never silently duplicated by
 * a repeat click. The lead is force-marked WON if it wasn't already: you
 * cannot have a client without a deal that closed.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.LEAD_CONVERT], async (principal) => {
    const { id } = await params;

    const lead = await prisma.lead.findFirst({
      where: { id, ...scopeFilter(principal, PERMISSIONS.LEAD_READ, { ownerField: 'ownerId' }) },
    });
    if (!lead) return errorResponse(404, 'NOT_FOUND', 'Lead not found');

    if (lead.convertedClientId) {
      return errorResponse(409, 'CONFLICT', 'This lead has already been converted');
    }

    let body: { monthlyRetainer?: unknown; accountManagerId?: unknown };
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    let accountManagerId = lead.ownerId;
    if (typeof body.accountManagerId === 'string' && body.accountManagerId) {
      const manager = await prisma.user.findFirst({
        where: { id: body.accountManagerId },
        select: { id: true },
      });
      if (!manager) return errorResponse(404, 'NOT_FOUND', 'Account manager not found');
      accountManagerId = manager.id;
    }

    const now = new Date();

    const client = await prisma.$transaction(async (tx) => {
      const created = await tx.client.create({
        data: {
          organizationId: principal.organizationId,
          name: lead.company || lead.name,
          industry: lead.industry,
          services: lead.services,
          email: lead.email,
          phone: lead.phone,
          city: lead.city,
          monthlyRetainer: typeof body.monthlyRetainer === 'number' ? body.monthlyRetainer : null,
          accountManagerId,
          contractStartDate: now,
          status: 'ONBOARDING',
          createdById: principal.userId,
        },
      });

      await tx.lead.update({
        where: { id },
        data: {
          status: LeadStatus.WON,
          stageChangedAt: lead.status === LeadStatus.WON ? lead.stageChangedAt : now,
          winReason: lead.winReason ?? 'Converted to client',
          convertedClientId: created.id,
          convertedAt: now,
        },
      });

      await tx.activity.create({
        data: {
          organizationId: principal.organizationId,
          type: 'SYSTEM',
          leadId: id,
          clientId: created.id,
          actorId: principal.userId,
          title: 'Converted to client',
        },
      });

      return created;
    });

    const withManager = await prisma.client.findFirstOrThrow({
      where: { id: client.id },
      include: CLIENT_INCLUDE,
    });

    return successResponse(presentClient(withManager));
  });
}
