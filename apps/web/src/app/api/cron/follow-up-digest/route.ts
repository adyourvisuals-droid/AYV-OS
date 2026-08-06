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
 * due today, plus reminders for today's shoots (to assigned crew) and
 * today's still-unpublished scheduled content (to its author) — three
 * unrelated reminders sharing one cron because they're all "things that
 * would otherwise rely on someone remembering to check a list," and adding
 * a new scheduled Vercel Cron entry per reminder isn't worth the deploy
 * config sprawl for jobs this cheap. Wired to Vercel Cron via vercel.json
 * (see the crons entry there) — this route is otherwise unreachable
 * without CRON_SECRET.
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

    const shoots = await notifyTodaysShoots(todayStart, todayEnd);
    const content = await notifyTodaysContent(todayStart, todayEnd);

    return successResponse({
      repsWithFollowUps: byOwner.size,
      notified,
      alreadySent,
      shoots,
      content,
    });
  });
}

/** One reminder per crew member per shoot happening today. */
async function notifyTodaysShoots(todayStart: Date, todayEnd: Date) {
  const shoots = await prisma.shoot.findMany({
    where: { status: { in: ['PLANNED', 'CONFIRMED'] }, scheduledAt: { gte: todayStart, lte: todayEnd } },
    select: { id: true, organizationId: true, title: true, location: true, scheduledAt: true, crewIds: true },
  });

  let notified = 0;
  let alreadySent = 0;

  for (const shoot of shoots) {
    for (const userId of shoot.crewIds) {
      const existing = await prisma.notification.findFirst({
        where: { userId, type: 'SHOOT_REMINDER', entityId: shoot.id, createdAt: { gte: todayStart } },
        select: { id: true },
      });
      if (existing) {
        alreadySent += 1;
        continue;
      }

      await prisma.notification.create({
        data: {
          organizationId: shoot.organizationId,
          userId,
          type: 'SHOOT_REMINDER',
          title: `Shoot today: ${shoot.title}`,
          body: shoot.location ?? undefined,
          link: '/creative/shoots',
          severity: 'INFO',
          entityType: 'Shoot',
          entityId: shoot.id,
        },
      });
      notified += 1;
    }
  }

  return { notified, alreadySent };
}

/** One reminder per author for each SCHEDULED post whose slot is today but hasn't gone out yet. */
async function notifyTodaysContent(todayStart: Date, todayEnd: Date) {
  const posts = await prisma.socialPost.findMany({
    where: { status: 'SCHEDULED', scheduledAt: { gte: todayStart, lte: todayEnd }, authorId: { not: null } },
    select: { id: true, organizationId: true, authorId: true, caption: true, platforms: true },
  });

  let notified = 0;
  let alreadySent = 0;

  for (const post of posts) {
    const userId = post.authorId!;
    const existing = await prisma.notification.findFirst({
      where: { userId, type: 'CONTENT_DUE', entityId: post.id, createdAt: { gte: todayStart } },
      select: { id: true },
    });
    if (existing) {
      alreadySent += 1;
      continue;
    }

    await prisma.notification.create({
      data: {
        organizationId: post.organizationId,
        userId,
        type: 'CONTENT_DUE',
        title: `Post due today on ${post.platforms.join(', ')}`,
        body: post.caption ?? undefined,
        link: '/creative/calendar',
        severity: 'INFO',
        entityType: 'SocialPost',
        entityId: post.id,
      },
    });
    notified += 1;
  }

  return { notified, alreadySent };
}
