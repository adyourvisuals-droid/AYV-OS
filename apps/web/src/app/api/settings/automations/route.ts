import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { presentRule } from '@/lib/server/automation-present';
import { TRIGGER_KEYS } from '@/lib/server/automation-engine';
import { errorResponse, successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.AUTOMATION_READ], async () => {
    const rules = await prisma.automationRule.findMany({ orderBy: { createdAt: 'desc' } });
    return successResponse(rules.map((rule) => presentRule(rule)));
  });
}

const VALID_TRIGGER_TYPES = new Set(['EVENT', 'SCHEDULE', 'THRESHOLD', 'MANUAL', 'WEBHOOK']);

export async function POST(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.AUTOMATION_MANAGE], async (principal) => {
    let body: {
      name?: unknown;
      description?: unknown;
      triggerType?: unknown;
      triggerKey?: unknown;
      conditions?: unknown;
      actions?: unknown;
    };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const triggerType = typeof body.triggerType === 'string' ? body.triggerType : '';
    const triggerKey = typeof body.triggerKey === 'string' ? body.triggerKey : '';

    if (!name || !VALID_TRIGGER_TYPES.has(triggerType) || !triggerKey) {
      return errorResponse(400, 'VALIDATION_ERROR', 'name, triggerType and triggerKey are required');
    }
    if (triggerType === 'EVENT' && !(TRIGGER_KEYS as readonly string[]).includes(triggerKey)) {
      return errorResponse(
        400,
        'VALIDATION_ERROR',
        `triggerKey must be one of: ${TRIGGER_KEYS.join(', ')}`,
      );
    }

    const created = await prisma.automationRule.create({
      data: {
        organizationId: principal.organizationId,
        name,
        description: typeof body.description === 'string' ? body.description : null,
        triggerType,
        triggerKey,
        conditions: Array.isArray(body.conditions) ? body.conditions : [],
        actions: Array.isArray(body.actions) ? body.actions : [],
        isActive: false,
        createdById: principal.userId,
      },
    });

    return successResponse(presentRule(created));
  });
}
