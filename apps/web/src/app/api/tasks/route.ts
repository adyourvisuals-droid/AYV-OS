import type { NextRequest } from 'next/server';

import { PERMISSIONS, Priority, TaskStatus } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';
import { assignmentDenial } from '@/lib/server/task-assignment';
import { presentTask, recalculateProgress, TASK_INCLUDE } from '@/lib/server/tasks-present';

export const runtime = 'nodejs';

const PRIORITIES = Object.values(Priority);

function parsePriority(value: unknown): Priority | null {
  if (value === undefined) return Priority.MEDIUM;
  return typeof value === 'string' && (PRIORITIES as string[]).includes(value) ? (value as Priority) : null;
}

/**
 * Creates a task and, optionally, allots it to someone.
 *
 * Who may be given the work is decided by the scope on the caller's
 * TASK_ASSIGN grant rather than by the task itself: a head with ALL can
 * assign across the company, a lead with TEAM can assign within their team
 * and to anyone reporting to them, and everyone else can only take work
 * themselves. Creating a task and assigning it are separate permissions, so
 * a member who may create work still cannot push it onto someone else.
 */
export async function POST(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.TASK_CREATE], async (principal) => {
    let body: {
      projectId?: unknown;
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

    const projectId = typeof body.projectId === 'string' ? body.projectId : '';
    const title = typeof body.title === 'string' ? body.title.trim() : '';

    if (!projectId || !title) {
      return errorResponse(400, 'VALIDATION_ERROR', 'projectId and title are required');
    }

    const priority = parsePriority(body.priority);
    if (priority === null) {
      return errorResponse(400, 'VALIDATION_ERROR', `priority must be one of: ${PRIORITIES.join(', ')}`);
    }

    const project = await prisma.project.findFirst({ where: { id: projectId }, select: { id: true } });
    if (!project) return errorResponse(404, 'NOT_FOUND', 'Project not found');

    let assigneeId: string | null = null;
    if (typeof body.assigneeId === 'string' && body.assigneeId) {
      const denied = await assignmentDenial(principal, body.assigneeId);
      if (denied) return denied;
      assigneeId = body.assigneeId;
    }

    let dueDate: Date | null = null;
    if (typeof body.dueDate === 'string' && body.dueDate) {
      const parsed = new Date(body.dueDate);
      if (Number.isNaN(parsed.getTime())) {
        return errorResponse(400, 'VALIDATION_ERROR', 'dueDate must be a valid date');
      }
      dueDate = parsed;
    }

    // New work lands at the bottom of the backlog column.
    const last = await prisma.task.findFirst({
      where: { projectId, status: TaskStatus.TODO },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    const created = await prisma.task.create({
      data: {
        organizationId: principal.organizationId,
        projectId,
        title,
        description: typeof body.description === 'string' ? body.description : null,
        status: TaskStatus.TODO,
        priority,
        assigneeId,
        dueDate,
        clientVisible: body.clientVisible === true,
        position: (last?.position ?? 0) + 1000,
        createdById: principal.userId,
      },
      include: TASK_INCLUDE,
    });

    await recalculateProgress(prisma, projectId);

    return successResponse(presentTask(created));
  });
}

