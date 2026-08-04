import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { presentRule } from '@/lib/server/automation-present';
import { errorResponse, successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.AUTOMATION_MANAGE], async () => {
    const { id } = await params;

    let body: {
      name?: unknown;
      description?: unknown;
      isActive?: unknown;
      conditions?: unknown;
      actions?: unknown;
      triggerKey?: unknown;
    };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const rule = await prisma.automationRule.findFirst({ where: { id } });
    if (!rule) return errorResponse(404, 'NOT_FOUND', 'Automation rule not found');

    const updated = await prisma.automationRule.update({
      where: { id },
      data: {
        ...(typeof body.name === 'string' ? { name: body.name } : {}),
        ...(body.description !== undefined
          ? { description: typeof body.description === 'string' ? body.description : null }
          : {}),
        ...(typeof body.isActive === 'boolean' ? { isActive: body.isActive } : {}),
        ...(Array.isArray(body.conditions) ? { conditions: body.conditions } : {}),
        ...(Array.isArray(body.actions) ? { actions: body.actions } : {}),
        ...(typeof body.triggerKey === 'string' ? { triggerKey: body.triggerKey } : {}),
      },
    });

    return successResponse(presentRule(updated));
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.AUTOMATION_MANAGE], async () => {
    const { id } = await params;

    const rule = await prisma.automationRule.findFirst({ where: { id } });
    if (!rule) return errorResponse(404, 'NOT_FOUND', 'Automation rule not found');

    await prisma.automationRule.delete({ where: { id } });
    return successResponse({ success: true });
  });
}
