import type { NextRequest } from 'next/server';

import { ActivityType, PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { ACTIVITY_INCLUDE, presentActivity } from '@/lib/server/crm-present';
import { errorResponse, paginatedResponse, successResponse } from '@/lib/server/http';
import { scoreLead } from '@/lib/server/lead-scoring';
import { ListQuery, paginationMeta } from '@/lib/server/list-query';
import { withAuth } from '@/lib/server/require-auth';
import { scopeFilter } from '@/lib/server/scope';

export const runtime = 'nodejs';

/** The lead's timeline: calls, meetings, emails, WhatsApp threads, notes, and system events, newest first. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.ACTIVITY_READ], async (principal) => {
    const { id } = await params;

    const lead = await prisma.lead.findFirst({
      where: { id, ...scopeFilter(principal, PERMISSIONS.LEAD_READ, { ownerField: 'ownerId' }) },
      select: { id: true },
    });
    if (!lead) return errorResponse(404, 'NOT_FOUND', 'Lead not found');

    const query = new ListQuery(req.nextUrl.searchParams);

    const [rows, total] = await Promise.all([
      prisma.activity.findMany({
        where: { leadId: id },
        include: ACTIVITY_INCLUDE,
        orderBy: { occurredAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      prisma.activity.count({ where: { leadId: id } }),
    ]);

    return paginatedResponse(
      rows.map((row) => presentActivity(row)),
      paginationMeta(query.page, query.limit, total),
    );
  });
}

const LOGGABLE_TYPES = [
  ActivityType.NOTE,
  ActivityType.CALL,
  ActivityType.MEETING,
  ActivityType.EMAIL,
  ActivityType.WHATSAPP,
] as const;

/**
 * Logs a call, meeting, email, WhatsApp thread or note against a lead.
 *
 * Also touches lastActivityAt and rescoring — the lead-scoring heuristic
 * treats recency and activity count as trust signals, so a follow-up that
 * doesn't move the pipeline stage should still be able to move the score.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.ACTIVITY_CREATE], async (principal) => {
    const { id } = await params;

    const lead = await prisma.lead.findFirst({
      where: { id, ...scopeFilter(principal, PERMISSIONS.LEAD_READ, { ownerField: 'ownerId' }) },
      include: { _count: { select: { activities: true } } },
    });
    if (!lead) return errorResponse(404, 'NOT_FOUND', 'Lead not found');

    let body: {
      type?: unknown;
      title?: unknown;
      body?: unknown;
      outcome?: unknown;
      durationMinutes?: unknown;
      occurredAt?: unknown;
    };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const type = typeof body.type === 'string' && (LOGGABLE_TYPES as readonly string[]).includes(body.type)
      ? (body.type as ActivityType)
      : null;
    if (!type) {
      return errorResponse(400, 'VALIDATION_ERROR', `type must be one of: ${LOGGABLE_TYPES.join(', ')}`);
    }

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) return errorResponse(400, 'VALIDATION_ERROR', 'title is required');

    let occurredAt = new Date();
    if (typeof body.occurredAt === 'string' && body.occurredAt) {
      const parsed = new Date(body.occurredAt);
      if (Number.isNaN(parsed.getTime())) {
        return errorResponse(400, 'VALIDATION_ERROR', 'occurredAt must be a valid date');
      }
      occurredAt = parsed;
    }

    const created = await prisma.activity.create({
      data: {
        organizationId: principal.organizationId,
        type,
        leadId: id,
        actorId: principal.userId,
        title,
        body: typeof body.body === 'string' ? body.body : null,
        outcome: typeof body.outcome === 'string' ? body.outcome : null,
        durationMinutes: typeof body.durationMinutes === 'number' ? body.durationMinutes : null,
        occurredAt,
      },
      include: ACTIVITY_INCLUDE,
    });

    const scored = scoreLead({
      source: lead.source,
      status: lead.status,
      estimatedValue: Number(lead.estimatedValue),
      industry: lead.industry,
      services: lead.services,
      email: lead.email,
      phone: lead.phone,
      contactName: lead.contactName,
      createdAt: lead.createdAt,
      lastActivityAt: occurredAt,
      activityCount: lead._count.activities + 1,
    });

    await prisma.lead.update({
      where: { id },
      data: {
        lastActivityAt: occurredAt,
        score: scored.score,
        temperature: scored.temperature,
        closeProbability: scored.closeProbability,
      },
    });

    return successResponse(presentActivity(created));
  });
}
