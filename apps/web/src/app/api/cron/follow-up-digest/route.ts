import { timingSafeEqual } from 'node:crypto';

import { endOfDay, startOfDay } from 'date-fns';
import type { NextRequest } from 'next/server';

import { LeadStatus } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';
import { RequestContextStore } from '@/lib/server/request-context';

export const runtime = 'nodejs';

/**
 * Daily digest: one notification per rep who has a lead follow-up overdue or
 * due today, so "check your follow-ups" doesn't rely on someone remembering
 * to open the CRM. Wired to Vercel Cron via vercel.json (see the crons entry
 * there) — this route is otherwise unreachable without CRON_SECRET.
 *
 * Vercel sends `Authorization: Bearer $CRON_SECRET` on cron-triggered
 * invocations when that env var is set; this checks the same value.
 */
function authorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const header = req.headers.get('authorization') ?? '';
  const provided = header.replace(/^Bearer\s+/i, '').trim();
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);

  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  if (!authorised(req)) {
    return errorResponse(401, 'UNAUTHENTICATED', 'Invalid or missing cron secret');
  }

  // A platform job legitimately spans every tenant — the one deliberate use
  // of the tenant-scoping escape hatch, not a per-request auth bypass.
  return RequestContextStore.runUnscoped(async () => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    const due = await prisma.lead.findMany({
      where: {
        deletedAt: null,
        ownerId: { not: null },
        nextFollowUpAt: { not: null, lte: todayEnd },
        status: { notIn: [LeadStatus.WON, LeadStatus.LOST] },
      },
      select: { organizationId: true, ownerId: true, nextFollowUpAt: true },
    });

    const byOwner = new Map<string, { organizationId: string; ownerId: string; overdue: number; today: number }>();
    for (const lead of due) {
      const key = lead.ownerId!;
      const group = byOwner.get(key) ?? { organizationId: lead.organizationId, ownerId: key, overdue: 0, today: 0 };
      if (lead.nextFollowUpAt! < todayStart) group.overdue += 1;
      else group.today += 1;
      byOwner.set(key, group);
    }

    let notified = 0;
    let alreadySent = 0;

    for (const group of byOwner.values()) {
      // Idempotent against a cron that fires more than once in a day —
      // one digest per rep per day, not one per invocation.
      const existing = await prisma.notification.findFirst({
        where: { userId: group.ownerId, type: 'FOLLOW_UP_DIGEST', createdAt: { gte: todayStart } },
        select: { id: true },
      });
      if (existing) {
        alreadySent += 1;
        continue;
      }

      const total = group.overdue + group.today;
      const parts: string[] = [];
      if (group.overdue > 0) parts.push(`${group.overdue} overdue`);
      if (group.today > 0) parts.push(`${group.today} due today`);

      await prisma.notification.create({
        data: {
          organizationId: group.organizationId,
          userId: group.ownerId,
          type: 'FOLLOW_UP_DIGEST',
          title: `${total} lead follow-up${total === 1 ? '' : 's'} waiting`,
          body: parts.join(' · '),
          link: '/crm/leads/follow-ups',
          severity: group.overdue > 0 ? 'WARNING' : 'INFO',
        },
      });
      notified += 1;
    }

    return successResponse({ repsWithFollowUps: byOwner.size, notified, alreadySent });
  });
}
