import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';
import { presentShoot, SHOOT_INCLUDE, SHOOT_STATUSES } from '@/lib/server/shoot-present';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.SHOOT_READ], async () => {
    const query = req.nextUrl.searchParams;
    const status = query.get('status');
    const clientId = query.get('clientId');
    const from = query.get('from');
    const to = query.get('to');
    const limit = Math.min(Number(query.get('limit')) || 200, 500);

    if (status && !(SHOOT_STATUSES as readonly string[]).includes(status)) {
      return errorResponse(400, 'VALIDATION_ERROR', `status must be one of: ${SHOOT_STATUSES.join(', ')}`);
    }

    const scheduledAt: Record<string, Date> = {};
    if (from && !Number.isNaN(Date.parse(from))) scheduledAt.gte = new Date(from);
    if (to && !Number.isNaN(Date.parse(to))) scheduledAt.lte = new Date(to);

    const shoots = await prisma.shoot.findMany({
      where: {
        ...(status ? { status: status as never } : {}),
        ...(clientId ? { clientId } : {}),
        ...(Object.keys(scheduledAt).length > 0 ? { scheduledAt } : {}),
      },
      include: SHOOT_INCLUDE,
      orderBy: { scheduledAt: 'asc' },
      take: limit,
    });

    return successResponse(shoots.map((shoot) => presentShoot(shoot)));
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.SHOOT_MANAGE], async (principal) => {
    let body: {
      title?: unknown;
      clientId?: unknown;
      type?: unknown;
      scheduledAt?: unknown;
      endAt?: unknown;
      location?: unknown;
      crewIds?: unknown;
      equipment?: unknown;
      notes?: unknown;
      status?: unknown;
    };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) return errorResponse(400, 'VALIDATION_ERROR', 'title is required');

    if (typeof body.scheduledAt !== 'string' || Number.isNaN(Date.parse(body.scheduledAt))) {
      return errorResponse(400, 'VALIDATION_ERROR', 'scheduledAt is required and must be a valid date');
    }

    const status =
      typeof body.status === 'string' && (SHOOT_STATUSES as readonly string[]).includes(body.status)
        ? body.status
        : 'PLANNED';

    const created = await prisma.shoot.create({
      data: {
        organizationId: principal.organizationId,
        title,
        clientId: typeof body.clientId === 'string' && body.clientId ? body.clientId : null,
        type: typeof body.type === 'string' && body.type ? body.type : null,
        scheduledAt: new Date(body.scheduledAt),
        endAt:
          typeof body.endAt === 'string' && !Number.isNaN(Date.parse(body.endAt)) ? new Date(body.endAt) : null,
        location: typeof body.location === 'string' ? body.location : null,
        crewIds: Array.isArray(body.crewIds) ? body.crewIds.filter((c): c is string => typeof c === 'string') : [],
        equipment: typeof body.equipment === 'string' ? body.equipment : null,
        notes: typeof body.notes === 'string' ? body.notes : null,
        status: status as never,
        createdById: principal.userId,
      },
      include: SHOOT_INCLUDE,
    });

    return successResponse(presentShoot(created));
  });
}
