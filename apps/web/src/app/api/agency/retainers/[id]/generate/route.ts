import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';
import { parseTemplate, presentRetainer } from '@/lib/server/retainer-present';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

/**
 * Opens a month for a retainer: creates its deliverable lines for that period
 * from the committed template. Idempotent — if the period already has lines,
 * nothing is duplicated, so re-clicking "start month" never resets progress.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.RETAINER_MANAGE], async () => {
    const { id } = await params;

    let body: { month?: unknown; year?: unknown };
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const now = new Date();
    const month = Number(body.month) || now.getMonth() + 1;
    const year = Number(body.year) || now.getFullYear();
    if (month < 1 || month > 12) return errorResponse(400, 'VALIDATION_ERROR', 'month must be 1–12');

    const retainer = await prisma.retainer.findFirst({ where: { id } });
    if (!retainer) return errorResponse(404, 'NOT_FOUND', 'Retainer not found');

    const existing = await prisma.retainerDeliverable.count({ where: { retainerId: id, month, year } });
    if (existing === 0) {
      const template = parseTemplate(retainer.deliverablesTemplate);
      if (template.length > 0) {
        await prisma.retainerDeliverable.createMany({
          data: template.map((item, position) => ({
            retainerId: id,
            month,
            year,
            label: item.label,
            committed: item.quantity,
            delivered: 0,
            position,
          })),
        });
      }
    }

    const withPeriod = await prisma.retainer.findFirstOrThrow({
      where: { id },
      include: { client: { select: { id: true, name: true } }, deliverables: { where: { month, year } } },
    });

    return successResponse(presentRetainer(withPeriod, withPeriod.deliverables, { month, year }));
  });
}
