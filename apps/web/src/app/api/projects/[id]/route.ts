import type { NextRequest } from 'next/server';

import { PERMISSIONS, TaskStatus } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';
import { PROJECT_INCLUDE, presentProject, projectVisibilityFilter } from '@/lib/server/projects-present';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

async function taskCounts(projectId: string): Promise<Record<string, number>> {
  const grouped = await prisma.task.groupBy({
    by: ['status'],
    where: { projectId },
    _count: { _all: true },
  });

  const counts = Object.fromEntries(Object.values(TaskStatus).map((status) => [status, 0]));
  for (const row of grouped) counts[row.status] = row._count._all;
  return counts;
}

/** Project detail with milestones and task counts. Mirrors ProjectsService#findOne. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.PROJECT_READ], async (principal) => {
    const { id } = await params;

    const project = await prisma.project.findFirst({
      where: { id, ...projectVisibilityFilter(principal) },
      include: {
        ...PROJECT_INCLUDE,
        milestones: { orderBy: { position: 'asc' } },
      },
    });

    if (!project) return errorResponse(404, 'NOT_FOUND', 'Project not found');

    return successResponse({
      ...presentProject(project, principal),
      milestones: project.milestones,
      taskCounts: await taskCounts(id),
    });
  });
}
