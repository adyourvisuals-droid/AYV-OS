import type { NextRequest } from 'next/server';
import type { Prisma } from '../../../../../../generated/prisma';

import { PERMISSIONS, PIPELINE_STAGES } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { LEAD_INCLUDE, presentLead } from '@/lib/server/crm-present';
import { successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';
import { scopeFilter } from '@/lib/server/scope';

export const runtime = 'nodejs';

/** Board payload: leads bucketed by stage with per-column totals. Mirrors LeadsService#board. */
export async function GET(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.LEAD_READ], async (principal) => {
    const where: Prisma.LeadWhereInput = {
      ...scopeFilter(principal, PERMISSIONS.LEAD_READ, { ownerField: 'ownerId' }),
      status: { in: PIPELINE_STAGES },
    };

    const leads = await prisma.lead.findMany({
      where,
      include: LEAD_INCLUDE,
      orderBy: [{ score: 'desc' }, { stageChangedAt: 'desc' }],
      take: 500,
    });

    const columns = PIPELINE_STAGES.map((stage) => {
      const stageLeads = leads.filter((lead) => lead.status === stage);
      return {
        stage,
        count: stageLeads.length,
        value: stageLeads.reduce((sum, lead) => sum + Number(lead.estimatedValue), 0),
        leads: stageLeads.map((lead) => presentLead(lead)),
      };
    });

    return successResponse(columns);
  });
}
