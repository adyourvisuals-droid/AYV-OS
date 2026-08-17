import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';
import {
  BILLING_CYCLES,
  parseDeliverables,
  presentServicePackage,
  SERVICE_CATEGORIES,
} from '@/lib/server/service-package-present';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.PACKAGE_MANAGE], async () => {
    const { id } = await params;

    const pkg = await prisma.servicePackage.findFirst({ where: { id } });
    if (!pkg) return errorResponse(404, 'NOT_FOUND', 'Package not found');

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const data: Record<string, unknown> = {};
    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim();
    if (body.category !== undefined) {
      data.category =
        typeof body.category === 'string' && (SERVICE_CATEGORIES as readonly string[]).includes(body.category)
          ? body.category
          : null;
    }
    if (body.description !== undefined) data.description = typeof body.description === 'string' && body.description ? body.description : null;
    if (body.price !== undefined) {
      const price = typeof body.price === 'number' ? body.price : Number(body.price);
      if (Number.isFinite(price) && price >= 0) data.price = price;
    }
    if (typeof body.billingCycle === 'string' && (BILLING_CYCLES as readonly string[]).includes(body.billingCycle)) {
      data.billingCycle = body.billingCycle;
    }
    if (body.deliverables !== undefined) data.deliverables = parseDeliverables(body.deliverables);
    if (typeof body.isActive === 'boolean') data.isActive = body.isActive;

    const updated = await prisma.servicePackage.update({ where: { id }, data });
    return successResponse(presentServicePackage(updated));
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.PACKAGE_MANAGE], async () => {
    const { id } = await params;

    const pkg = await prisma.servicePackage.findFirst({ where: { id } });
    if (!pkg) return errorResponse(404, 'NOT_FOUND', 'Package not found');

    await prisma.servicePackage.delete({ where: { id } });
    return successResponse({ id });
  });
}
