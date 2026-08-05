import type { NextRequest } from 'next/server';

import { PERMISSIONS, Priority } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';
import { assignmentDenial } from '@/lib/server/task-assignment';
import { presentTask, taskVisibilityFilter, TASK_INCLUDE } from '@/lib/server/tasks-present';

export const runtime = 'nodejs';

const PRIORITIES = Object.values(Priority);

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.TASK_READ], async (principal) => {
    const { id } = await params;

    const task = await prisma.task.findFirst({
      where: { id, ...(await taskVisibilityFilter(principal)) },
      include: TASK_INCLUDE,
    });
    if (!task) return errorResponse(404, 'NOT_FOUND', 'Task not found');

    return successResponse(presentTask(task));
  });
}

/**
 * Edits a task, including reassigning it.
 *
 * Reassignment runs the same hierarchy check as creation, so who may hand
 * work to whom does not depend on which screen the change came from. Status
 * and ordering are deliberately not handled here — the board's drag and drop
 * owns those, via the move endpoint.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.TASK_UPDATE], async (principal) => {
    const { id } = await params;

    let body: {
      title?: unknown;
      description?: unknown;
      assigneeId?: unknown;
      priority?: unknown;
      dueDate?: unknown;
      clientVisible?: unknown;
    };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const task = await prisma.task.findFirst({ where: { id, ...(await taskVisibilityFilter(principal)) } });
    if (!task) return errorResponse(404, 'NOT_FOUND', 'Task not found');

    const data: Record<string, unknown> = {};

    if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim();
    if (body.description !== undefined) {
      data.description = typeof body.description === 'string' ? body.description : null;
    }
    if (typeof body.clientVisible === 'boolean') data.clientVisible = body.clientVisible;

    if (body.priority !== undefined) {
      if (typeof body.priority !== 'string' || !(PRIORITIES as string[]).includes(body.priority)) {
        return errorResponse(400, 'VALIDATION_ERROR', `priority must be one of: ${PRIORITIES.join(', ')}`);
      }
      data.priority = body.priority as Priority;
    }

    if (body.dueDate !== undefined) {
      if (body.dueDate === null || body.dueDate === '') {
        data.dueDate = null;
      } else if (typeof body.dueDate === 'string') {
        const parsed = new Date(body.dueDate);
        if (Number.isNaN(parsed.getTime())) {
          return errorResponse(400, 'VALIDATION_ERROR', 'dueDate must be a valid date');
        }
        data.dueDate = parsed;
      }
    }

    if (body.assigneeId !== undefined) {
      if (body.assigneeId === null || body.assigneeId === '') {
        // Returning work to the unassigned pool needs the same authority as
        // taking it off the current owner.
        if (task.assigneeId && task.assigneeId !== principal.userId) {
          if (!principal.permissions.includes(PERMISSIONS.TASK_ASSIGN)) {
            return errorResponse(403, 'INSUFFICIENT_PERMISSION', 'You cannot unassign another person’s task');
          }
        }
        data.assigneeId = null;
      } else if (typeof body.assigneeId === 'string') {
        const denied = await assignmentDenial(principal, body.assigneeId);
        if (denied) return denied;
        data.assigneeId = body.assigneeId;
      }
    }

    if (Object.keys(data).length === 0) {
      return errorResponse(400, 'VALIDATION_ERROR', 'No supported fields to update');
    }

    const updated = await prisma.task.update({ where: { id }, data, include: TASK_INCLUDE });

    return successResponse(presentTask(updated));
  });
}
