import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { executiveDashboard, type DashboardPeriod } from '@/lib/server/analytics';
import { successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

const VALID_PERIODS: DashboardPeriod[] = ['week', 'month', 'quarter', 'year'];

/** The Executive Dashboard payload. Mirrors AnalyticsService#executive. */
export async function GET(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.DASHBOARD_EXECUTIVE], async () => {
    const requested = req.nextUrl.searchParams.get('period');
    const period: DashboardPeriod = VALID_PERIODS.includes(requested as DashboardPeriod)
      ? (requested as DashboardPeriod)
      : 'month';

    return successResponse(await executiveDashboard(period));
  });
}
