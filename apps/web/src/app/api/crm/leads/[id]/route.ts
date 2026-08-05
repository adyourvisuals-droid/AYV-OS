import type { NextRequest } from 'next/server';

import { Industry, PERMISSIONS, ServiceType } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { LEAD_INCLUDE, presentLead } from '@/lib/server/crm-present';
import { errorResponse, successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';
import { scopeFilter } from '@/lib/server/scope';

export const runtime = 'nodejs';

const INDUSTRIES = Object.values(Industry);
const SERVICES = Object.values(ServiceType);

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.LEAD_READ], async (principal) => {
    const { id } = await params;

    const lead = await prisma.lead.findFirst({
      where: { id, ...scopeFilter(principal, PERMISSIONS.LEAD_READ, { ownerField: 'ownerId' }) },
      include: {
        ...LEAD_INCLUDE,
        _count: { select: { activities: true, quotations: true } },
      },
    });
    if (!lead) return errorResponse(404, 'NOT_FOUND', 'Lead not found');

    return successResponse({
      ...presentLead(lead),
      counts: { activities: lead._count.activities, quotations: lead._count.quotations },
    });
  });
}

/** Edits a lead's profile fields. Pipeline stage moves through the dedicated /stage endpoint. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.LEAD_UPDATE], async (principal) => {
    const { id } = await params;

    let body: {
      name?: unknown;
      contactName?: unknown;
      email?: unknown;
      phone?: unknown;
      company?: unknown;
      city?: unknown;
      industry?: unknown;
      services?: unknown;
      estimatedValue?: unknown;
      notes?: unknown;
      ownerId?: unknown;
      customFields?: unknown;
      nextFollowUpAt?: unknown;
    };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const lead = await prisma.lead.findFirst({
      where: { id, ...scopeFilter(principal, PERMISSIONS.LEAD_READ, { ownerField: 'ownerId' }) },
    });
    if (!lead) return errorResponse(404, 'NOT_FOUND', 'Lead not found');

    const data: Record<string, unknown> = {};

    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim();
    if (body.contactName !== undefined) data.contactName = typeof body.contactName === 'string' ? body.contactName : null;
    if (body.email !== undefined) data.email = typeof body.email === 'string' ? body.email : null;
    if (body.phone !== undefined) data.phone = typeof body.phone === 'string' ? body.phone : null;
    if (body.company !== undefined) data.company = typeof body.company === 'string' ? body.company : null;
    if (body.city !== undefined) data.city = typeof body.city === 'string' ? body.city : null;
    if (body.notes !== undefined) data.notes = typeof body.notes === 'string' ? body.notes : null;

    if (body.industry !== undefined) {
      if (body.industry !== null && !(INDUSTRIES as string[]).includes(body.industry as string)) {
        return errorResponse(400, 'VALIDATION_ERROR', `industry must be one of: ${INDUSTRIES.join(', ')}`);
      }
      data.industry = body.industry;
    }

    if (body.services !== undefined) {
      if (!Array.isArray(body.services) || body.services.some((s) => !(SERVICES as string[]).includes(s))) {
        return errorResponse(400, 'VALIDATION_ERROR', `services must be from: ${SERVICES.join(', ')}`);
      }
      data.services = body.services;
    }

    if (body.estimatedValue !== undefined) {
      if (typeof body.estimatedValue !== 'number' || body.estimatedValue < 0) {
        return errorResponse(400, 'VALIDATION_ERROR', 'estimatedValue must be a non-negative number');
      }
      data.estimatedValue = body.estimatedValue;
    }

    if (typeof body.customFields === 'object' && body.customFields !== null && !Array.isArray(body.customFields)) {
      data.customFields = body.customFields;
    }

    // null clears the follow-up (mark done without rescheduling); a string
    // sets or reschedules it.
    if (body.nextFollowUpAt !== undefined) {
      if (body.nextFollowUpAt === null) {
        data.nextFollowUpAt = null;
      } else if (typeof body.nextFollowUpAt === 'string') {
        const parsed = new Date(body.nextFollowUpAt);
        if (Number.isNaN(parsed.getTime())) {
          return errorResponse(400, 'VALIDATION_ERROR', 'nextFollowUpAt must be a valid date');
        }
        data.nextFollowUpAt = parsed;
      } else {
        return errorResponse(400, 'VALIDATION_ERROR', 'nextFollowUpAt must be a date string or null');
      }
    }

    if (body.ownerId !== undefined) {
      if (body.ownerId !== principal.userId && !principal.permissions.includes(PERMISSIONS.LEAD_ASSIGN)) {
        return errorResponse(403, 'INSUFFICIENT_PERMISSION', 'You cannot reassign this lead');
      }
      if (body.ownerId === null) {
        data.ownerId = null;
      } else if (typeof body.ownerId === 'string') {
        const owner = await prisma.user.findFirst({ where: { id: body.ownerId }, select: { id: true } });
        if (!owner) return errorResponse(404, 'NOT_FOUND', 'Owner not found');
        data.ownerId = owner.id;
      }
    }

    if (Object.keys(data).length === 0) {
      return errorResponse(400, 'VALIDATION_ERROR', 'No supported fields to update');
    }

    const updated = await prisma.lead.update({ where: { id }, data, include: LEAD_INCLUDE });

    return successResponse(presentLead(updated));
  });
}
