import type { NextRequest } from 'next/server';
import type { Prisma } from '../../../../../generated/prisma';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { EXPENSE_INCLUDE, presentExpense } from '@/lib/server/finance-present';
import { errorResponse, successResponse } from '@/lib/server/http';
import { ListQuery } from '@/lib/server/list-query';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

const SORTABLE_FIELDS = ['incurredAt', 'amount', 'status', 'createdAt'];

export async function GET(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.EXPENSE_READ], async (principal) => {
    const query = new ListQuery(req.nextUrl.searchParams);
    const status = query.get('status');
    const category = query.get('category');

    // Anyone who can only create expenses (not read all) sees their own;
    // approvers and finance see everything the read permission's scope allows.
    const canSeeAll = principal.permissionScopes[PERMISSIONS.EXPENSE_READ] === 'ALL';

    const where: Prisma.ExpenseWhereInput = {
      ...(canSeeAll ? {} : { submittedById: principal.userId }),
      ...(status ? { status: status as never } : {}),
      ...(category ? { category } : {}),
      ...(query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {}),
      ...(query.deleted ? { deletedAt: { not: null } } : {}),
    };

    const rows = await prisma.expense.findMany({
      where,
      include: EXPENSE_INCLUDE,
      orderBy: query.orderBy(SORTABLE_FIELDS, [{ incurredAt: 'desc' }]),
      skip: query.skip,
      take: query.limit,
    });

    return successResponse(rows.map((row) => presentExpense(row)));
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.EXPENSE_CREATE], async (principal) => {
    let body: {
      title?: unknown;
      category?: unknown;
      description?: unknown;
      amount?: unknown;
      incurredAt?: unknown;
      vendorId?: unknown;
    };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const category = typeof body.category === 'string' ? body.category.trim() : '';
    const amount = typeof body.amount === 'number' && body.amount > 0 ? body.amount : null;

    if (!title || !category || !amount) {
      return errorResponse(400, 'VALIDATION_ERROR', 'title, category and a positive amount are required');
    }

    const created = await prisma.expense.create({
      data: {
        organizationId: principal.organizationId,
        title,
        category,
        description: typeof body.description === 'string' ? body.description : null,
        amount,
        status: 'SUBMITTED',
        incurredAt:
          typeof body.incurredAt === 'string' && !Number.isNaN(Date.parse(body.incurredAt))
            ? new Date(body.incurredAt)
            : new Date(),
        submittedById: principal.userId,
        vendorId: typeof body.vendorId === 'string' ? body.vendorId : null,
      },
      include: EXPENSE_INCLUDE,
    });

    return successResponse(presentExpense(created));
  });
}
