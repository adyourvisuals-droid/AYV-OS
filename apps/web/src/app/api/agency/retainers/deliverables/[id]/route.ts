import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

/** Records progress on one deliverable line — bump delivered, or adjust the committed count. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.RETAINER_MANAGE], async () => {
    const { id } = await params;

    const item = await prisma.retainerDeliverable.findFirst({ where: { id } });
    if (!item) return errorResponse(404, 'NOT_FOUND', 'Deliverable not found');

    let body: { delivered?: unknown; committed?: unknown; delta?: unknown };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const data: Record<string, number> = {};

    // `delta` bumps delivered up or down (the "+1 delivered" button); an
    // explicit `delivered`/`committed` sets the value directly.
    if (typeof body.delta === 'number') {
      data.delivered = Math.max(0, item.delivered + Math.round(body.delta));
    } else if (body.delivered !== undefined) {
      const n = Number(body.delivered);
      if (Number.isFinite(n) && n >= 0) data.delivered = Math.round(n);
    }
    if (body.committed !== undefined) {
      const n = Number(body.committed);
      if (Number.isFinite(n) && n >= 0) data.committed = Math.round(n);
    }

    if (Object.keys(data).length === 0) {
      return errorResponse(400, 'VALIDATION_ERROR', 'Nothing to update');
    }

    const updated = await prisma.retainerDeliverable.update({ where: { id }, data });
    return successResponse({
      id: updated.id,
      label: updated.label,
      committed: updated.committed,
      delivered: updated.delivered,
    });
  });
}
