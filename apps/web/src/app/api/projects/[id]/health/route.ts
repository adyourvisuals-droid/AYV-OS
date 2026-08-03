import type { NextRequest } from 'next/server';

import { PERMISSIONS, TaskStatus } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';
import { projectVisibilityFilter } from '@/lib/server/projects-present';
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

/**
 * Schedule, budget and throughput risk for a single project. Mirrors
 * ProjectsService#health.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.PROJECT_READ], async (principal) => {
    const { id } = await params;

    const project = await prisma.project.findFirst({
      where: { id, ...projectVisibilityFilter(principal) },
    });
    if (!project) return errorResponse(404, 'NOT_FOUND', 'Project not found');

    const counts = await taskCounts(id);

    const risks: { type: string; severity: 'LOW' | 'MEDIUM' | 'HIGH'; message: string }[] = [];

    if (project.startDate && project.dueDate) {
      const totalMs = project.dueDate.getTime() - project.startDate.getTime();
      const elapsedMs = Date.now() - project.startDate.getTime();
      const timeElapsed = totalMs > 0 ? Math.min(100, (elapsedMs / totalMs) * 100) : 0;

      if (timeElapsed > 80 && project.progress < 50) {
        risks.push({
          type: 'SCHEDULE',
          severity: 'HIGH',
          message: `${Math.round(timeElapsed)}% of the timeline used with only ${project.progress}% of tasks complete`,
        });
      } else if (timeElapsed - project.progress > 25) {
        risks.push({
          type: 'SCHEDULE',
          severity: 'MEDIUM',
          message: 'Progress is falling behind the elapsed timeline',
        });
      }
    }

    if (project.dueDate && project.dueDate < new Date() && project.status !== 'COMPLETED') {
      risks.push({
        type: 'OVERDUE',
        severity: 'HIGH',
        message: `Past the due date by ${Math.ceil((Date.now() - project.dueDate.getTime()) / 86_400_000)} days`,
      });
    }

    if (counts[TaskStatus.BLOCKED] > 0) {
      risks.push({
        type: 'BLOCKED',
        severity: counts[TaskStatus.BLOCKED] > 2 ? 'HIGH' : 'MEDIUM',
        message: `${counts[TaskStatus.BLOCKED]} task(s) blocked`,
      });
    }

    const budget = project.budget === null ? null : Number(project.budget);
    const cost = project.internalCost === null ? null : Number(project.internalCost);

    if (budget !== null && cost !== null && budget > 0 && cost / budget > 0.8) {
      risks.push({
        type: 'BUDGET',
        severity: cost > budget ? 'HIGH' : 'MEDIUM',
        message: `${Math.round((cost / budget) * 100)}% of budget consumed`,
      });
    }

    return successResponse({
      projectId: id,
      progress: project.progress,
      taskCounts: counts,
      risks,
      status:
        risks.some((risk) => risk.severity === 'HIGH')
          ? 'AT_RISK'
          : risks.length > 0
            ? 'WATCH'
            : 'ON_TRACK',
    });
  });
}
