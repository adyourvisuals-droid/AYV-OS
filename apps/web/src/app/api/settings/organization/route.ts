import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';
import { presentOrganizationProfile } from '@/lib/server/organization-present';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.ORG_READ], async (principal) => {
    const organization = await prisma.organization.findFirst({ where: { id: principal.organizationId } });
    if (!organization) return errorResponse(404, 'NOT_FOUND', 'Organization not found');

    return successResponse(presentOrganizationProfile(organization));
  });
}

const STRING_FIELDS = [
  'legalName',
  'logoUrl',
  'website',
  'email',
  'phone',
  'addressLine1',
  'addressLine2',
  'city',
  'state',
  'stateCode',
  'country',
  'postalCode',
  'gstNumber',
  'panNumber',
  'bankName',
  'bankAccountName',
  'bankAccountNumber',
  'bankIfscCode',
  'bankUpiId',
] as const;

export async function PATCH(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.ORG_UPDATE], async (principal) => {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const data: Record<string, string | null> = {};
    for (const field of STRING_FIELDS) {
      if (field in body) {
        const value = body[field];
        if (value !== null && typeof value !== 'string') {
          return errorResponse(400, 'VALIDATION_ERROR', `${field} must be a string or null`);
        }
        data[field] = value === '' ? null : (value as string | null);
      }
    }

    const updated = await prisma.organization.update({
      where: { id: principal.organizationId },
      data,
    });

    return successResponse(presentOrganizationProfile(updated));
  });
}
