import type { NextRequest } from 'next/server';

import { ALL_PERMISSIONS, PERMISSION_DESCRIPTIONS, PERMISSIONS, groupPermissions } from '@ayv/types';

import { successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

/** The full permission registry, grouped by domain — reference data for the role editor. */
export async function GET(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.ROLE_READ], async () => {
    const grouped = groupPermissions(ALL_PERMISSIONS);

    return successResponse(
      Object.entries(grouped).map(([domain, permissions]) => ({
        domain,
        permissions: permissions.map((permission) => ({
          key: permission,
          description: PERMISSION_DESCRIPTIONS[permission] ?? null,
        })),
      })),
    );
  });
}
