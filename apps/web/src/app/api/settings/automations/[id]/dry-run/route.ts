import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import {
  describeAction,
  evaluateCondition,
  sampleRecordFor,
  type Condition,
  type RuleAction,
} from '@/lib/server/automation-engine';
import { errorResponse, successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

/**
 * Evaluates a rule's conditions against a real, currently-matching record
 * and reports which actions would fire — without executing or persisting
 * anything. This is the "dry-run simulation" from the original spec; there
 * is no live event engine wiring actions into real mutations yet.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.AUTOMATION_READ], async () => {
    const { id } = await params;

    const rule = await prisma.automationRule.findFirst({ where: { id } });
    if (!rule) return errorResponse(404, 'NOT_FOUND', 'Automation rule not found');

    const sample = await sampleRecordFor(rule.triggerKey);
    if (!sample) {
      return successResponse({
        matched: false,
        sample: null,
        message: `No record currently matches trigger "${rule.triggerKey}" to simulate against.`,
        actionsWouldRun: [],
      });
    }

    const conditions = Array.isArray(rule.conditions) ? (rule.conditions as unknown as Condition[]) : [];
    const matched = conditions.every((condition) => evaluateCondition(sample, condition));

    const actions = Array.isArray(rule.actions) ? (rule.actions as unknown as RuleAction[]) : [];

    return successResponse({
      matched,
      sample,
      message: matched
        ? 'All conditions passed against this record.'
        : 'This record did not pass every condition — no actions would run.',
      actionsWouldRun: matched ? actions.map((action) => describeAction(action, sample)) : [],
    });
  });
}
