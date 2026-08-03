import type { NextRequest } from 'next/server';

import { PERMISSIONS, TaskStatus } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';
import {
  positionBetween,
  presentTask,
  recalculateProgress,
  statusTransition,
  taskVisibilityFilter,
  TASK_INCLUDE,
} from '@/lib/server/tasks-present';

export const runtime = 'nodejs';

/**
 * Moves a task between board columns and reorders it. Mirrors
 * TasksService#move.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.TASK_UPDATE], async (principal) => {
    const { id } = await params;

    let body: { status?: unknown; beforeTaskId?: unknown; afterTaskId?: unknown };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const status = typeof body.status === 'string' ? (body.status as TaskStatus) : null;
    const beforeTaskId = typeof body.beforeTaskId === 'string' ? body.beforeTaskId : undefined;
    const afterTaskId = typeof body.afterTaskId === 'string' ? body.afterTaskId : undefined;

    if (!status) {
      return errorResponse(400, 'VALIDATION_ERROR', 'status is required');
    }

    const task = await prisma.task.findFirst({
      where: { id, ...taskVisibilityFilter(principal) },
    });
    if (!task) return errorResponse(404, 'NOT_FOUND', 'Task not found');

    const position = await positionBetween(prisma, task.projectId, status, beforeTaskId, afterTaskId);

    const updated = await prisma.task.update({
      where: { id },
      data: { position, ...statusTransition(status) },
      include: TASK_INCLUDE,
    });

    if (task.status !== status) {
      await recalculateProgress(prisma, task.projectId);
    }

    return successResponse(presentTask(updated));
  });
}
