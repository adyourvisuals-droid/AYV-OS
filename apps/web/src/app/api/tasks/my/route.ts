import type { NextRequest } from 'next/server';

import { PERMISSIONS, TaskStatus } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';
import { presentTask, TASK_INCLUDE } from '@/lib/server/tasks-present';

export const runtime = 'nodejs';

/** The current user's open work, ordered by urgency. Mirrors TasksService#myTasks. */
export async function GET(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.TASK_READ], async (principal) => {
    const tasks = await prisma.task.findMany({
      where: {
        assigneeId: principal.userId,
        status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] },
      },
      include: TASK_INCLUDE,
      orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }],
      take: 100,
    });

    return successResponse(tasks.map((task) => presentTask(task)));
  });
}
