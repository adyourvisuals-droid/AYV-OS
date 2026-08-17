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

export async function GET(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.PACKAGE_READ], async () => {
    const activeOnly = req.nextUrl.searchParams.get('active') === 'true';

    const packages = await prisma.servicePackage.findMany({
      where: activeOnly ? { isActive: true } : {},
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });

    return successResponse(packages.map((pkg) => presentServicePackage(pkg)));
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.PACKAGE_MANAGE], async (principal) => {
    let body: {
      name?: unknown;
      category?: unknown;
      description?: unknown;
      price?: unknown;
      billingCycle?: unknown;
      deliverables?: unknown;
    };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return errorResponse(400, 'VALIDATION_ERROR', 'name is required');

    const category =
      typeof body.category === 'string' && (SERVICE_CATEGORIES as readonly string[]).includes(body.category)
        ? body.category
        : null;
    const billingCycle =
      typeof body.billingCycle === 'string' && (BILLING_CYCLES as readonly string[]).includes(body.billingCycle)
        ? body.billingCycle
        : 'MONTHLY';
    const price = typeof body.price === 'number' ? body.price : Number(body.price);

    const created = await prisma.servicePackage.create({
      data: {
        organizationId: principal.organizationId,
        name,
        category: category as never,
        description: typeof body.description === 'string' && body.description ? body.description : null,
        price: Number.isFinite(price) && price >= 0 ? price : 0,
        billingCycle: billingCycle as never,
        deliverables: parseDeliverables(body.deliverables),
      },
    });

    return successResponse(presentServicePackage(created));
  });
}
