import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { presentCapiEvent, sendClientConversion } from '@/lib/server/capi-service';
import { clientVisibilityFilter } from '@/lib/server/clients-present';
import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

/**
 * Fires a conversion for this client on demand — for verifying the wiring.
 *
 * `dryRun: true` (the default) builds and logs the exact request without ever
 * calling Meta, so the payload and its hashing can be checked safely. Set
 * `dryRun: false` to actually send it, routed to Meta's test tab via the
 * configured test_event_code. Either way a CapiEvent is written.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.CAPI_MANAGE], async (principal) => {
    const { id } = await params;

    const client = await prisma.client.findFirst({
      where: { id, ...clientVisibilityFilter(principal) },
      select: { id: true, name: true, email: true, phone: true, city: true, currency: true },
    });
    if (!client) return errorResponse(404, 'NOT_FOUND', 'Client not found');

    let body: {
      dryRun?: unknown;
      eventName?: unknown;
      email?: unknown;
      phone?: unknown;
      value?: unknown;
    };
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    // Default to a dry run — a naked "test" button must never send live data.
    const dryRun = body.dryRun === false ? false : true;

    const outcome = await sendClientConversion({
      organizationId: principal.organizationId,
      clientId: client.id,
      eventName: typeof body.eventName === 'string' && body.eventName.trim() ? body.eventName.trim() : undefined,
      userData: {
        email: typeof body.email === 'string' && body.email ? body.email : client.email,
        phone: typeof body.phone === 'string' && body.phone ? body.phone : client.phone,
        city: client.city,
      },
      value: typeof body.value === 'number' ? body.value : null,
      currency: client.currency,
      dryRun,
      testMode: true,
      createdById: principal.userId,
    });

    if (outcome.skipped) {
      return errorResponse(
        400,
        'VALIDATION_ERROR',
        'No active Meta Conversions API config for this client — add one first.',
      );
    }

    return successResponse({
      event: presentCapiEvent(outcome.event),
      result: outcome.result ?? null,
    });
  });
}
