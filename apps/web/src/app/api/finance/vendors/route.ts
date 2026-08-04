import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { presentVendor } from '@/lib/server/finance-present';
import { errorResponse, successResponse } from '@/lib/server/http';
import { ListQuery } from '@/lib/server/list-query';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.VENDOR_MANAGE], async () => {
    const query = new ListQuery(req.nextUrl.searchParams);

    const rows = await prisma.vendor.findMany({
      where: query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {},
      orderBy: { name: 'asc' },
      take: query.limit,
    });

    return successResponse(rows.map((row) => presentVendor(row)));
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.VENDOR_MANAGE], async (principal) => {
    let body: { name?: unknown; category?: unknown; email?: unknown; phone?: unknown; gstNumber?: unknown };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return errorResponse(400, 'VALIDATION_ERROR', 'name is required');

    const created = await prisma.vendor.create({
      data: {
        organizationId: principal.organizationId,
        name,
        category: typeof body.category === 'string' ? body.category : null,
        email: typeof body.email === 'string' ? body.email : null,
        phone: typeof body.phone === 'string' ? body.phone : null,
        gstNumber: typeof body.gstNumber === 'string' ? body.gstNumber : null,
      },
    });

    return successResponse(presentVendor(created));
  });
}
