import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';
import { presentShoot, SHOOT_INCLUDE, SHOOT_STATUSES } from '@/lib/server/shoot-present';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.SHOOT_READ], async () => {
    const { id } = await params;

    const shoot = await prisma.shoot.findFirst({ where: { id }, include: SHOOT_INCLUDE });
    if (!shoot) return errorResponse(404, 'NOT_FOUND', 'Shoot not found');

    return successResponse(presentShoot(shoot));
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.SHOOT_MANAGE], async () => {
    const { id } = await params;

    const shoot = await prisma.shoot.findFirst({ where: { id } });
    if (!shoot) return errorResponse(404, 'NOT_FOUND', 'Shoot not found');

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

    const data: Record<string, unknown> = {};
    if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim();
    if (body.clientId !== undefined) data.clientId = typeof body.clientId === 'string' && body.clientId ? body.clientId : null;
    if (body.type !== undefined) data.type = typeof body.type === 'string' && body.type ? body.type : null;
    if (typeof body.scheduledAt === 'string' && !Number.isNaN(Date.parse(body.scheduledAt))) {
      data.scheduledAt = new Date(body.scheduledAt);
    }
    if (body.endAt !== undefined) {
      data.endAt =
        typeof body.endAt === 'string' && !Number.isNaN(Date.parse(body.endAt)) ? new Date(body.endAt) : null;
    }
    if (body.location !== undefined) data.location = typeof body.location === 'string' ? body.location : null;
    if (body.crewIds !== undefined) {
      data.crewIds = Array.isArray(body.crewIds) ? body.crewIds.filter((c): c is string => typeof c === 'string') : [];
    }
    if (body.equipment !== undefined) data.equipment = typeof body.equipment === 'string' ? body.equipment : null;
    if (body.notes !== undefined) data.notes = typeof body.notes === 'string' ? body.notes : null;
    if (typeof body.status === 'string') {
      if (!(SHOOT_STATUSES as readonly string[]).includes(body.status)) {
        return errorResponse(400, 'VALIDATION_ERROR', `status must be one of: ${SHOOT_STATUSES.join(', ')}`);
      }
      data.status = body.status;
    }

    const updated = await prisma.shoot.update({ where: { id }, data, include: SHOOT_INCLUDE });
    return successResponse(presentShoot(updated));
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.SHOOT_MANAGE], async () => {
    const { id } = await params;

    const shoot = await prisma.shoot.findFirst({ where: { id } });
    if (!shoot) return errorResponse(404, 'NOT_FOUND', 'Shoot not found');

    await prisma.shoot.delete({ where: { id } });
    return successResponse({ id });
  });
}
