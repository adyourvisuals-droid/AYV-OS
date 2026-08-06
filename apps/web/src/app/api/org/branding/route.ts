import type { NextRequest } from 'next/server';

import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';
import { presentBranding } from '@/lib/server/organization-present';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

/**
 * Letterhead data (org name, address, GST, bank details) for printable
 * documents — every authenticated tenant member can read it, since anyone
 * printing an invoice/quotation/contract needs it, regardless of whether
 * they hold ORG_READ.
 */
export async function GET(req: NextRequest) {
  return withAuth(req, [], async (principal) => {
    const organization = await prisma.organization.findFirst({ where: { id: principal.organizationId } });
    if (!organization) return errorResponse(404, 'NOT_FOUND', 'Organization not found');

    return successResponse(presentBranding(organization));
  });
}
