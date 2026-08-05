import { endOfDay, startOfDay } from 'date-fns';

import { LeadStatus, PERMISSIONS } from '@ayv/types';

import type { Prisma } from '../../../generated/prisma';

import type { AuthPrincipal } from './auth';
import { LEAD_INCLUDE, presentLead } from './crm-present';
import { prisma } from './db';
import { scopeFilter } from './scope';

/**
 * Every lead with a follow-up date, bucketed against "right now" — the shape
 * a rep actually works from: what's late, what's due today, what's coming.
 *
 * Won and lost leads are excluded even if a stale nextFollowUpAt lingers on
 * them; a closed deal is not something to chase.
 */
export async function followUpBuckets(principal: AuthPrincipal) {
  const now = new Date();

  const leads = await prisma.lead.findMany({
    where: {
      ...scopeFilter(principal, PERMISSIONS.LEAD_READ, { ownerField: 'ownerId' }),
      nextFollowUpAt: { not: null },
      status: { notIn: [LeadStatus.WON, LeadStatus.LOST] },
    } as Prisma.LeadWhereInput,
    include: LEAD_INCLUDE,
    orderBy: { nextFollowUpAt: 'asc' },
  });

  const todayEnd = endOfDay(now);
  const overdue = [];
  const today = [];
  const upcoming = [];

  for (const lead of leads) {
    const due = lead.nextFollowUpAt!;
    if (due < startOfDay(now)) overdue.push(lead);
    else if (due <= todayEnd) today.push(lead);
    else upcoming.push(lead);
  }

  return {
    overdue: overdue.map((lead) => presentLead(lead)),
    today: today.map((lead) => presentLead(lead)),
    upcoming: upcoming.map((lead) => presentLead(lead)),
  };
}
