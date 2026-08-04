import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { CLIENT_INCLUDE, clientVisibilityFilter, presentClient } from '@/lib/server/clients-present';
import { validateCustomFieldValues } from '@/lib/server/custom-fields';
import { errorResponse, successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

/** Client detail with contacts and related counts. Mirrors ClientsService#findOne. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.CLIENT_READ], async (principal) => {
    const { id } = await params;

    const client = await prisma.client.findFirst({
      where: { id, ...clientVisibilityFilter(principal) },
      include: {
        ...CLIENT_INCLUDE,
        contacts: { orderBy: { isPrimary: 'desc' } },
        _count: { select: { projects: true, invoices: true, tickets: true } },
      },
    });

    if (!client) return errorResponse(404, 'NOT_FOUND', 'Client not found');

    return successResponse({
      ...presentClient(client),
      contacts: client.contacts,
      counts: {
        projects: client._count.projects,
        invoices: client._count.invoices,
        tickets: client._count.tickets,
      },
    });
  });
}

/**
 * Scoped to customFields only — there is no general client-editing endpoint
 * yet, and building one is out of scope for the custom fields feature.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.CLIENT_UPDATE], async (principal) => {
    const { id } = await params;

    let body: { customFields?: unknown };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    if (typeof body.customFields !== 'object' || body.customFields === null || Array.isArray(body.customFields)) {
      return errorResponse(400, 'VALIDATION_ERROR', 'customFields must be an object');
    }

    const client = await prisma.client.findFirst({ where: { id, ...clientVisibilityFilter(principal) } });
    if (!client) return errorResponse(404, 'NOT_FOUND', 'Client not found');

    const definitions = await prisma.customFieldDefinition.findMany({ where: { entityType: 'CLIENT' } });
    const result = validateCustomFieldValues(definitions, body.customFields as Record<string, unknown>);
    if (!result.ok) return errorResponse(400, 'VALIDATION_ERROR', result.error);

    await prisma.client.update({ where: { id }, data: { customFields: result.values } });

    const updated = await prisma.client.findFirstOrThrow({
      where: { id },
      include: {
        ...CLIENT_INCLUDE,
        contacts: { orderBy: { isPrimary: 'desc' } },
        _count: { select: { projects: true, invoices: true, tickets: true } },
      },
    });

    return successResponse({
      ...presentClient(updated),
      contacts: updated.contacts,
      counts: {
        projects: updated._count.projects,
        invoices: updated._count.invoices,
        tickets: updated._count.tickets,
      },
    });
  });
}
