import type { NextRequest } from 'next/server';

import { LeadStatus, PERMISSIONS } from '@ayv/types';

import { dispatchLeadWonConversion } from '@/lib/server/capi-service';
import { prisma } from '@/lib/server/db';
import { LEAD_INCLUDE, presentLead } from '@/lib/server/crm-present';
import { errorResponse, successResponse } from '@/lib/server/http';
import { scoreLead } from '@/lib/server/lead-scoring';
import { withAuth } from '@/lib/server/require-auth';
import { scopeFilter } from '@/lib/server/scope';

export const runtime = 'nodejs';

/** Recomputes and persists the lead score, mirroring LeadsService#rescore. */
async function rescore(id: string) {
  const lead = await prisma.lead.findFirst({
    where: { id },
    include: { _count: { select: { activities: true } } },
  });
  if (!lead) return;

  const result = scoreLead({
    source: lead.source,
    status: lead.status,
    estimatedValue: Number(lead.estimatedValue),
    industry: lead.industry,
    services: lead.services,
    email: lead.email,
    phone: lead.phone,
    contactName: lead.contactName,
    createdAt: lead.createdAt,
    lastActivityAt: lead.lastActivityAt,
    activityCount: lead._count.activities,
  });

  await prisma.lead.update({
    where: { id },
    data: {
      score: result.score,
      temperature: result.temperature,
      closeProbability: result.closeProbability,
    },
  });
}

/** Moves a lead between pipeline stages. Mirrors LeadsService#moveStage. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.LEAD_UPDATE], async (principal) => {
    const { id } = await params;

    let body: { status?: unknown; reason?: unknown };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const status = typeof body.status === 'string' ? (body.status as LeadStatus) : null;
    const reason = typeof body.reason === 'string' ? body.reason : undefined;

    if (!status) {
      return errorResponse(400, 'VALIDATION_ERROR', 'status is required');
    }

    const lead = await prisma.lead.findFirst({
      where: { id, ...scopeFilter(principal, PERMISSIONS.LEAD_READ, { ownerField: 'ownerId' }) },
    });
    if (!lead) return errorResponse(404, 'NOT_FOUND', 'Lead not found');

    if (lead.status === status) {
      const current = await prisma.lead.findUniqueOrThrow({ where: { id }, include: LEAD_INCLUDE });
      return successResponse(presentLead(current));
    }

    if (status === LeadStatus.LOST && !reason) {
      return errorResponse(400, 'VALIDATION_ERROR', 'A reason is required when marking a lead as lost');
    }

    const now = new Date();
    const durationHours = Math.max(
      0,
      Math.round((now.getTime() - lead.stageChangedAt.getTime()) / 3_600_000),
    );

    const [updated] = await prisma.$transaction([
      prisma.lead.update({
        where: { id },
        data: {
          status,
          stageChangedAt: now,
          ...(status === LeadStatus.LOST ? { lostReason: reason } : {}),
          ...(status === LeadStatus.WON ? { winReason: reason } : {}),
        },
        include: LEAD_INCLUDE,
      }),
      prisma.leadStageEvent.create({
        data: {
          leadId: id,
          fromStage: lead.status,
          toStage: status,
          durationHours,
          actorId: principal.userId,
        },
      }),
      prisma.activity.create({
        data: {
          organizationId: principal.organizationId,
          type: 'STAGE_CHANGE',
          leadId: id,
          actorId: principal.userId,
          title: `Moved to ${status}`,
          body: reason,
        },
      }),
    ]);

    await rescore(id);

    // A won lead that's already tied to a client with Meta wiring reports the
    // conversion back to Meta — closing the loop on the ad that sourced it.
    if (status === LeadStatus.WON && updated.convertedClientId) {
      await dispatchLeadWonConversion({
        id: updated.id,
        organizationId: updated.organizationId,
        convertedClientId: updated.convertedClientId,
        email: updated.email,
        phone: updated.phone,
        contactName: updated.contactName,
        city: updated.city,
        estimatedValue: updated.estimatedValue,
        currency: updated.currency,
        sourceMeta: updated.sourceMeta,
        createdById: principal.userId,
      });
    }

    return successResponse(presentLead(updated));
  });
}
