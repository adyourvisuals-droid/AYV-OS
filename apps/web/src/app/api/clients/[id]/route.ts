import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { CLIENT_INCLUDE, clientVisibilityFilter, presentClient } from '@/lib/server/clients-present';
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
