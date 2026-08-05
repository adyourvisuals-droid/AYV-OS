import type { NextRequest } from 'next/server';

import { PERMISSIONS, TASK_BOARD_COLUMNS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';
import { presentTask, taskVisibilityFilter, TASK_INCLUDE } from '@/lib/server/tasks-present';

export const runtime = 'nodejs';

/** Kanban board for a project: tasks bucketed into columns, in order. Mirrors TasksService#board. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.TASK_READ], async (principal) => {
    const { id } = await params;

    const tasks = await prisma.task.findMany({
      where: {
        projectId: id,
        parentTaskId: null,
        ...(await taskVisibilityFilter(principal)),
      },
      include: TASK_INCLUDE,
      orderBy: { position: 'asc' },
    });

    const columns = TASK_BOARD_COLUMNS.map((status) => {
      const columnTasks = tasks.filter((task) => task.status === status);
      return {
        status,
        count: columnTasks.length,
        tasks: columnTasks.map((task) => presentTask(task)),
      };
    });

    return successResponse(columns);
  });
}
