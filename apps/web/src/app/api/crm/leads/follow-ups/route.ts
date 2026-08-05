import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { followUpBuckets } from '@/lib/server/follow-ups';
import { successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

/** The caller's leads with a follow-up date, split into overdue / today / upcoming. */
export async function GET(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.LEAD_READ], async (principal) => {
    return successResponse(await followUpBuckets(principal));
  });
}
