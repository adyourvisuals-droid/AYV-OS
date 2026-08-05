import { PERMISSIONS, TaskStatus } from '@ayv/types';

import type { Prisma } from '../../../generated/prisma';

import type { AuthPrincipal } from './auth';
import { reportingTreeIds } from './hierarchy';
import { scopeFilter, scopeOf } from './scope';

export const TASK_INCLUDE = {
  assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
  project: { select: { id: true, name: true, code: true } },
  _count: { select: { subtasks: true, comments: true } },
} satisfies Prisma.TaskInclude;

type TaskWithRelations = Prisma.TaskGetPayload<{ include: typeof TASK_INCLUDE }>;

/**
 * Portal users only ever see tasks explicitly marked client-visible, on
 * projects belonging to their own client. Mirrors TasksService#visibilityFilter.
 *
 * At TEAM scope this also follows the reporting line, not just the team
 * record. Team membership alone cannot express a manager who owns people
 * across several teams, and it silently excluded anyone with no team at all,
 * so a manager's own reports were invisible to them.
 */
export async function taskVisibilityFilter(principal: AuthPrincipal): Promise<Prisma.TaskWhereInput> {
  if (principal.clientId) {
    return { clientVisible: true, project: { clientId: principal.clientId } };
  }

  if (scopeOf(principal, PERMISSIONS.TASK_READ) === 'TEAM') {
    const visible = new Set(await reportingTreeIds(principal.userId));

    return {
      OR: [
        { assigneeId: { in: [...visible] } },
        ...(principal.teamId ? [{ assignee: { teamId: principal.teamId } }] : []),
      ],
    };
  }

  return scopeFilter(principal, PERMISSIONS.TASK_READ, {
    ownerField: 'assigneeId',
  }) as Prisma.TaskWhereInput;
}

/** Mirrors apps/api's TasksService#present. */
export function presentTask(task: TaskWithRelations) {
  const isOverdue =
    task.dueDate !== null &&
    task.dueDate < new Date() &&
    task.status !== TaskStatus.DONE &&
    task.status !== TaskStatus.CANCELLED;

  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    projectId: task.projectId,
    projectName: task.project?.name ?? null,
    projectCode: task.project?.code ?? null,
    assignee: task.assignee
      ? {
          id: task.assignee.id,
          name: task.assignee.name,
          email: task.assignee.email,
          avatarUrl: task.assignee.avatarUrl,
          initials: task.assignee.name
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase() ?? '')
            .join(''),
        }
      : null,
    dueDate: task.dueDate?.toISOString() ?? null,
    estimatedHours: task.estimatedHours === null ? null : Number(task.estimatedHours),
    position: task.position,
    labels: task.labels,
    clientVisible: task.clientVisible,
    isBlocked: task.status === TaskStatus.BLOCKED,
    isOverdue,
    subtaskCount: task._count.subtasks,
    commentCount: task._count.comments,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

/** Gap between adjacent card positions when a column is first laid out. */
const POSITION_STEP = 1000;

async function nextPosition(
  prisma: import('./prisma-extensions').ExtendedPrismaClient,
  projectId: string,
  status: TaskStatus,
): Promise<number> {
  const last = await prisma.task.findFirst({
    where: { projectId, status },
    orderBy: { position: 'desc' },
    select: { position: true },
  });

  return (last?.position ?? 0) + POSITION_STEP;
}

async function renumberColumn(
  prisma: import('./prisma-extensions').ExtendedPrismaClient,
  projectId: string,
  status: TaskStatus,
): Promise<void> {
  const tasks = await prisma.task.findMany({
    where: { projectId, status },
    orderBy: { position: 'asc' },
    select: { id: true },
  });

  await prisma.$transaction(
    tasks.map((task, index) =>
      prisma.task.update({
        where: { id: task.id },
        data: { position: (index + 1) * POSITION_STEP },
      }),
    ),
  );
}

/**
 * Position is a float placed midway between its new neighbours, so a drag
 * costs one UPDATE rather than renumbering the whole column. When the gap
 * between neighbours gets too small to halve meaningfully, the column is
 * renumbered once and the move retried. Mirrors TasksService#positionBetween.
 */
export async function positionBetween(
  prisma: import('./prisma-extensions').ExtendedPrismaClient,
  projectId: string,
  status: TaskStatus,
  beforeTaskId?: string,
  afterTaskId?: string,
): Promise<number> {
  const [before, after] = await Promise.all([
    beforeTaskId
      ? prisma.task.findFirst({ where: { id: beforeTaskId }, select: { position: true } })
      : null,
    afterTaskId
      ? prisma.task.findFirst({ where: { id: afterTaskId }, select: { position: true } })
      : null,
  ]);

  if (!before && after) return after.position - POSITION_STEP;
  if (before && !after) return before.position + POSITION_STEP;

  if (before && after) {
    const gap = Math.abs(after.position - before.position);
    if (gap > 0.001) return (before.position + after.position) / 2;

    await renumberColumn(prisma, projectId, status);
    return nextPosition(prisma, projectId, status);
  }

  return nextPosition(prisma, projectId, status);
}

/** Keeps `startedAt` / `completedAt` consistent with the status. */
export function statusTransition(status: TaskStatus): {
  status: TaskStatus;
  startedAt?: Date;
  completedAt: Date | null;
} {
  if (status === TaskStatus.DONE) {
    return { status, completedAt: new Date() };
  }
  if (status === TaskStatus.IN_PROGRESS) {
    return { status, startedAt: new Date(), completedAt: null };
  }
  return { status, completedAt: null };
}

/** Project progress is derived from task completion, never set by hand. */
export async function recalculateProgress(
  prisma: import('./prisma-extensions').ExtendedPrismaClient,
  projectId: string,
): Promise<void> {
  const [total, done] = await Promise.all([
    prisma.task.count({ where: { projectId, status: { not: TaskStatus.CANCELLED } } }),
    prisma.task.count({ where: { projectId, status: TaskStatus.DONE } }),
  ]);

  await prisma.project.update({
    where: { id: projectId },
    data: { progress: total === 0 ? 0 : Math.round((done / total) * 100) },
  });
}
