import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';
import { parseTemplate, presentRetainer, RETAINER_STATUSES } from '@/lib/server/retainer-present';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.RETAINER_MANAGE], async () => {
    const { id } = await params;

    const retainer = await prisma.retainer.findFirst({ where: { id } });
    if (!retainer) return errorResponse(404, 'NOT_FOUND', 'Retainer not found');

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const data: Record<string, unknown> = {};
    if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim();
    if (body.monthlyValue !== undefined) {
      const v = typeof body.monthlyValue === 'number' ? body.monthlyValue : Number(body.monthlyValue);
      if (Number.isFinite(v) && v >= 0) data.monthlyValue = v;
    }
    if (body.deliverablesTemplate !== undefined) data.deliverablesTemplate = parseTemplate(body.deliverablesTemplate);
    if (body.startDate !== undefined) {
      data.startDate =
        typeof body.startDate === 'string' && !Number.isNaN(Date.parse(body.startDate))
          ? new Date(body.startDate)
          : null;
    }
    if (typeof body.status === 'string' && (RETAINER_STATUSES as readonly string[]).includes(body.status)) {
      data.status = body.status;
    }

    const updated = await prisma.retainer.update({
      where: { id },
      data,
      include: { client: { select: { id: true, name: true } }, deliverables: true },
    });
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    return successResponse(
      presentRetainer(
        updated,
        updated.deliverables.filter((d) => d.month === month && d.year === year),
        { month, year },
      ),
    );
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.RETAINER_MANAGE], async () => {
    const { id } = await params;
    const retainer = await prisma.retainer.findFirst({ where: { id } });
    if (!retainer) return errorResponse(404, 'NOT_FOUND', 'Retainer not found');

    await prisma.retainer.delete({ where: { id } });
    return successResponse({ id });
  });
}
