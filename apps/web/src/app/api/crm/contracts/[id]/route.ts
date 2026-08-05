import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { CONTRACT_INCLUDE, presentContract } from '@/lib/server/contracts-present';
import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';
import { scopeFilter } from '@/lib/server/scope';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.CONTRACT_READ], async (principal) => {
    const { id } = await params;

    const contract = await prisma.contract.findFirst({
      where: {
        id,
        ...scopeFilter(principal, PERMISSIONS.CONTRACT_READ, { ownerField: 'createdById' }),
      },
      include: CONTRACT_INCLUDE,
    });
    if (!contract) return errorResponse(404, 'NOT_FOUND', 'Contract not found');

    return successResponse(presentContract(contract));
  });
}

/**
 * Edits a contract. There is no dedicated CONTRACT_UPDATE permission in the
 * registry — the same authority that creates a contract shapes its own
 * draft, and once it's SENT there's nothing left to edit here; a fresh
 * document is a new contract. Gated the same way creation is.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.CONTRACT_CREATE], async () => {
    const { id } = await params;

    const contract = await prisma.contract.findFirst({ where: { id } });
    if (!contract) return errorResponse(404, 'NOT_FOUND', 'Contract not found');
    if (contract.status !== 'DRAFT') {
      return errorResponse(400, 'VALIDATION_ERROR', 'Only a draft contract can be edited');
    }

    let body: {
      title?: unknown;
      value?: unknown;
      currency?: unknown;
      startDate?: unknown;
      endDate?: unknown;
      noticePeriodDays?: unknown;
      terms?: unknown;
      documentUrl?: unknown;
    };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const parseDate = (input: unknown): Date | null | undefined => {
      if (input === undefined) return undefined;
      if (input === null || input === '') return null;
      if (typeof input !== 'string') return undefined;
      const parsed = new Date(input);
      return Number.isNaN(parsed.getTime()) ? undefined : parsed;
    };

    const data: Record<string, unknown> = {};
    if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim();
    if (typeof body.value === 'number' && body.value >= 0) data.value = body.value;
    if (typeof body.currency === 'string' && body.currency) data.currency = body.currency;
    if (typeof body.noticePeriodDays === 'number') data.noticePeriodDays = body.noticePeriodDays;
    if (typeof body.documentUrl === 'string') data.documentUrl = body.documentUrl || null;
    if (typeof body.terms === 'object' && body.terms !== null) data.terms = body.terms;

    const startDate = parseDate(body.startDate);
    if (startDate !== undefined) data.startDate = startDate;
    const endDate = parseDate(body.endDate);
    if (endDate !== undefined) data.endDate = endDate;

    if (Object.keys(data).length === 0) {
      return errorResponse(400, 'VALIDATION_ERROR', 'No supported fields to update');
    }

    const updated = await prisma.contract.update({ where: { id }, data, include: CONTRACT_INCLUDE });
    return successResponse(presentContract(updated));
  });
}
