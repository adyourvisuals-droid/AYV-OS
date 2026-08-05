import type { NextRequest } from 'next/server';
import type { Prisma } from '../../../../../generated/prisma';

import { LeadSource, LeadStatus, PERMISSIONS, Temperature } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { LEAD_INCLUDE, presentLead } from '@/lib/server/crm-present';
import { errorResponse, paginatedResponse, successResponse } from '@/lib/server/http';
import { scoreLead } from '@/lib/server/lead-scoring';
import { ListQuery, paginationMeta } from '@/lib/server/list-query';
import { withAuth } from '@/lib/server/require-auth';
import { scopeFilter } from '@/lib/server/scope';

export const runtime = 'nodejs';

const SORTABLE_FIELDS = [
  'createdAt',
  'updatedAt',
  'name',
  'estimatedValue',
  'score',
  'stageChangedAt',
  'lastActivityAt',
];

export async function GET(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.LEAD_READ], async (principal) => {
    const query = new ListQuery(req.nextUrl.searchParams);
    const status = query.get('status');
    const temperature = query.get('temperature');
    const source = query.get('source');
    const ownerId = query.get('ownerId');
    const service = query.get('service');

    const where: Prisma.LeadWhereInput = {
      ...scopeFilter(principal, PERMISSIONS.LEAD_READ, { ownerField: 'ownerId' }),
      ...(status ? { status: status as never } : {}),
      ...(temperature ? { temperature: temperature as never } : {}),
      ...(source ? { source: source as never } : {}),
      ...(ownerId ? { ownerId } : {}),
      ...(service ? { services: { has: service as never } } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { contactName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search } },
              { company: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.deleted ? { deletedAt: { not: null } } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: LEAD_INCLUDE,
        orderBy: query.orderBy(SORTABLE_FIELDS, [{ stageChangedAt: 'desc' }]),
        skip: query.skip,
        take: query.limit,
      }),
      prisma.lead.count({ where }),
    ]);

    return paginatedResponse(
      rows.map((row) => presentLead(row)),
      paginationMeta(query.page, query.limit, total),
    );
  });
}

const SOURCES = Object.values(LeadSource);

/** Creates a lead and scores it immediately, so it never sits at a stale score=0. */
export async function POST(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.LEAD_CREATE], async (principal) => {
    let body: {
      name?: unknown;
      contactName?: unknown;
      email?: unknown;
      phone?: unknown;
      company?: unknown;
      city?: unknown;
      source?: unknown;
      industry?: unknown;
      services?: unknown;
      estimatedValue?: unknown;
      notes?: unknown;
      ownerId?: unknown;
    };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return errorResponse(400, 'VALIDATION_ERROR', 'name is required');
    }

    const source = typeof body.source === 'string' && (SOURCES as string[]).includes(body.source)
      ? (body.source as LeadSource)
      : LeadSource.MANUAL;

    const estimatedValue = typeof body.estimatedValue === 'number' && body.estimatedValue >= 0
      ? body.estimatedValue
      : 0;

    let ownerId: string | null = principal.userId;
    if (typeof body.ownerId === 'string' && body.ownerId) {
      // Handing a fresh lead straight to someone else is an assignment, so it
      // is gated the same way reassigning one later would be.
      if (body.ownerId !== principal.userId && !principal.permissions.includes(PERMISSIONS.LEAD_ASSIGN)) {
        return errorResponse(403, 'INSUFFICIENT_PERMISSION', 'You cannot assign a lead to someone else');
      }
      const owner = await prisma.user.findFirst({ where: { id: body.ownerId }, select: { id: true } });
      if (!owner) return errorResponse(404, 'NOT_FOUND', 'Owner not found');
      ownerId = owner.id;
    }

    const industry = typeof body.industry === 'string' ? body.industry : null;
    const services = Array.isArray(body.services)
      ? body.services.filter((service): service is string => typeof service === 'string')
      : [];

    const scored = scoreLead({
      source,
      status: LeadStatus.NEW,
      estimatedValue,
      industry,
      services,
      email: typeof body.email === 'string' ? body.email : null,
      phone: typeof body.phone === 'string' ? body.phone : null,
      contactName: typeof body.contactName === 'string' ? body.contactName : null,
      createdAt: new Date(),
      lastActivityAt: null,
      activityCount: 0,
    });

    const created = await prisma.lead.create({
      data: {
        organizationId: principal.organizationId,
        name,
        contactName: typeof body.contactName === 'string' ? body.contactName : null,
        email: typeof body.email === 'string' ? body.email : null,
        phone: typeof body.phone === 'string' ? body.phone : null,
        company: typeof body.company === 'string' ? body.company : null,
        city: typeof body.city === 'string' ? body.city : null,
        source,
        industry: industry as never,
        services: services as never,
        estimatedValue,
        notes: typeof body.notes === 'string' ? body.notes : null,
        ownerId,
        status: LeadStatus.NEW,
        temperature: scored.temperature as Temperature,
        score: scored.score,
        closeProbability: scored.closeProbability,
        createdById: principal.userId,
      },
      include: LEAD_INCLUDE,
    });

    await prisma.activity.create({
      data: {
        organizationId: principal.organizationId,
        type: 'SYSTEM',
        leadId: created.id,
        actorId: principal.userId,
        title: 'Lead created',
        body: `via ${source}`,
      },
    });

    return successResponse(presentLead(created));
  });
}
