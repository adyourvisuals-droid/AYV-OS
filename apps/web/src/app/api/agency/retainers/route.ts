import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';
import { parseTemplate, presentRetainer, RETAINER_STATUSES } from '@/lib/server/retainer-present';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

/** The retainer board for a month: every live retainer with its delivery progress that period. */
export async function GET(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.RETAINER_READ], async () => {
    const params = req.nextUrl.searchParams;
    const now = new Date();
    const month = Number(params.get('month')) || now.getMonth() + 1;
    const year = Number(params.get('year')) || now.getFullYear();
    const clientId = params.get('clientId');

    if (month < 1 || month > 12) return errorResponse(400, 'VALIDATION_ERROR', 'month must be 1–12');

    const retainers = await prisma.retainer.findMany({
      where: {
        ...(clientId ? { clientId } : {}),
        status: { not: 'ENDED' },
      },
      include: {
        client: { select: { id: true, name: true } },
        deliverables: { where: { month, year } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return successResponse(
      retainers.map((retainer) => presentRetainer(retainer, retainer.deliverables, { month, year })),
    );
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.RETAINER_MANAGE], async (principal) => {
    let body: {
      clientId?: unknown;
      packageId?: unknown;
      title?: unknown;
      monthlyValue?: unknown;
      startDate?: unknown;
      deliverablesTemplate?: unknown;
    };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const clientId = typeof body.clientId === 'string' ? body.clientId : '';
    if (!clientId) return errorResponse(400, 'VALIDATION_ERROR', 'clientId is required');
    const client = await prisma.client.findFirst({ where: { id: clientId } });
    if (!client) return errorResponse(404, 'NOT_FOUND', 'Client not found');

    // A package seeds the value, billing cycle and deliverable template; any
    // of those can then be overridden per-client on the retainer itself.
    let packageId: string | null = null;
    let template = parseTemplate(body.deliverablesTemplate);
    let monthlyValue = typeof body.monthlyValue === 'number' ? body.monthlyValue : Number(body.monthlyValue);
    let billingCycle: string = 'MONTHLY';
    let title = typeof body.title === 'string' ? body.title.trim() : '';

    if (typeof body.packageId === 'string' && body.packageId) {
      const pkg = await prisma.servicePackage.findFirst({ where: { id: body.packageId } });
      if (pkg) {
        packageId = pkg.id;
        billingCycle = pkg.billingCycle;
        if (!Number.isFinite(monthlyValue)) monthlyValue = Number(pkg.price);
        if (template.length === 0) template = parseTemplate(pkg.deliverables);
        if (!title) title = pkg.name;
      }
    }

    if (!title) return errorResponse(400, 'VALIDATION_ERROR', 'title (or a package) is required');

    const { id: createdId } = await prisma.retainer.create({
      data: {
        organizationId: principal.organizationId,
        clientId,
        packageId,
        title,
        monthlyValue: Number.isFinite(monthlyValue) && monthlyValue >= 0 ? monthlyValue : 0,
        billingCycle: billingCycle as never,
        startDate:
          typeof body.startDate === 'string' && !Number.isNaN(Date.parse(body.startDate))
            ? new Date(body.startDate)
            : null,
        deliverablesTemplate: template as never,
        status: RETAINER_STATUSES[0] as never,
      },
      select: { id: true },
    });

    const created = await prisma.retainer.findFirstOrThrow({
      where: { id: createdId },
      include: { client: { select: { id: true, name: true } }, deliverables: true },
    });

    const now = new Date();
    return successResponse(
      presentRetainer(created, created.deliverables, { month: now.getMonth() + 1, year: now.getFullYear() }),
    );
  });
}
