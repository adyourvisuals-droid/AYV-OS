import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Prisma } from '@prisma/client';

import { PERMISSIONS, TASK_BOARD_COLUMNS, TaskStatus } from '@ayv/types';
import type { AuthPrincipal } from '@/common/decorators';
import { paginationMeta, type Paginated } from '@/common/dto/pagination.dto';
import { scopeFilter } from '@/common/scope/scope.util';
import { PRISMA, type PrismaService } from '@/infra/prisma/prisma.module';
import { AuditService } from '@/modules/audit/audit.service';

import type {
  CreateCommentDto,
  CreateTaskDto,
  LogTimeDto,
  MoveTaskDto,
  TaskQueryDto,
  UpdateTaskDto,
} from './dto/project.dto';

const SORTABLE_FIELDS = ['createdAt', 'updatedAt', 'dueDate', 'priority', 'position', 'title'];

/** Gap between adjacent card positions when a column is first laid out. */
const POSITION_STEP = 1000;

const TASK_INCLUDE = {
  assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
  project: { select: { id: true, name: true, code: true } },
  _count: { select: { subtasks: true, comments: true } },
} satisfies Prisma.TaskInclude;

type TaskWithRelations = Prisma.TaskGetPayload<{ include: typeof TASK_INCLUDE }>;

@Injectable()
export class TasksService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  async list(query: TaskQueryDto, principal: AuthPrincipal): Promise<Paginated<unknown>> {
    const where: Prisma.TaskWhereInput = {
      ...this.visibilityFilter(principal),
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.assigneeId ? { assigneeId: query.assigneeId } : {}),
      ...(query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {}),
      ...(query.deleted ? { deletedAt: { not: null } } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        include: TASK_INCLUDE,
        orderBy: query.orderBy(SORTABLE_FIELDS, [{ position: 'asc' }]),
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.task.count({ where }),
    ]);

    return {
      data: rows.map((row) => this.present(row)),
      meta: paginationMeta(query.page, query.limit, total),
    };
  }

  /** Board payload for one project: tasks bucketed into columns, in order. */
  async board(projectId: string, principal: AuthPrincipal) {
    const tasks = await this.prisma.task.findMany({
      where: {
        projectId,
        parentTaskId: null,
        ...this.visibilityFilter(principal),
      },
      include: TASK_INCLUDE,
      orderBy: { position: 'asc' },
    });

    return TASK_BOARD_COLUMNS.map((status) => {
      const columnTasks = tasks.filter((task) => task.status === status);
      return {
        status,
        count: columnTasks.length,
        tasks: columnTasks.map((task) => this.present(task)),
      };
    });
  }

  /** The current user's open work, ordered by urgency. */
  async myTasks(principal: AuthPrincipal) {
    const tasks = await this.prisma.task.findMany({
      where: {
        assigneeId: principal.userId,
        status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] },
      },
      include: TASK_INCLUDE,
      orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }],
      take: 100,
    });

    return tasks.map((task) => this.present(task));
  }

  async findOne(id: string, principal: AuthPrincipal) {
    const task = await this.prisma.task.findFirst({
      where: { id, ...this.visibilityFilter(principal) },
      include: {
        ...TASK_INCLUDE,
        subtasks: { include: TASK_INCLUDE, orderBy: { position: 'asc' } },
        comments: {
          include: { author: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { createdAt: 'asc' },
        },
        timeLogs: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { loggedAt: 'desc' },
        },
        dependencies: { include: { blockingTask: { select: { id: true, title: true, status: true } } } },
      },
    });

    if (!task) throw new NotFoundException('Task not found');

    return {
      ...this.present(task),
      subtasks: task.subtasks.map((subtask) => this.present(subtask)),
      comments: task.comments,
      timeLogs: task.timeLogs,
      blockedBy: task.dependencies.map((dependency) => dependency.blockingTask),
    };
  }

  async create(dto: CreateTaskDto, principal: AuthPrincipal) {
    const project = await this.prisma.project.findFirst({
      where: { id: dto.projectId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    const status = dto.status ?? TaskStatus.BACKLOG;

    const created = await this.prisma.task.create({
      data: {
        organizationId: principal.organizationId,
        projectId: dto.projectId,
        title: dto.title,
        description: dto.description,
        status,
        priority: dto.priority ?? 'MEDIUM',
        assigneeId: dto.assigneeId,
        parentTaskId: dto.parentTaskId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        estimatedHours: dto.estimatedHours,
        labels: dto.labels ?? [],
        clientVisible: dto.clientVisible ?? false,
        position: await this.nextPosition(dto.projectId, status),
        createdById: principal.userId,
      },
      include: TASK_INCLUDE,
    });

    await this.recalculateProgress(dto.projectId);
    await this.audit.record({
      action: 'CREATE',
      entity: 'Task',
      entityId: created.id,
      after: created,
    });

    this.events.emit('task.created', {
      taskId: created.id,
      organizationId: principal.organizationId,
      projectId: dto.projectId,
      assigneeId: created.assigneeId,
    });

    return this.present(created);
  }

  async update(id: string, dto: UpdateTaskDto, principal: AuthPrincipal) {
    const before = await this.assertVisible(id, principal);

    const updated = await this.prisma.task.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.assigneeId !== undefined ? { assigneeId: dto.assigneeId } : {}),
        ...(dto.dueDate !== undefined
          ? { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }
          : {}),
        ...(dto.estimatedHours !== undefined ? { estimatedHours: dto.estimatedHours } : {}),
        ...(dto.labels !== undefined ? { labels: dto.labels } : {}),
        ...(dto.clientVisible !== undefined ? { clientVisible: dto.clientVisible } : {}),
        ...(dto.status !== undefined ? this.statusTransition(dto.status) : {}),
      },
      include: TASK_INCLUDE,
    });

    if (dto.status !== undefined && dto.status !== before.status) {
      await this.recalculateProgress(before.projectId);
    }

    await this.audit.record({
      action: 'UPDATE',
      entity: 'Task',
      entityId: id,
      before,
      after: updated,
    });

    return this.present(updated);
  }

  /**
   * Moves a task on the board.
   *
   * Position is a float placed midway between its new neighbours, so a drag
   * costs one UPDATE rather than renumbering the whole column. When the gap
   * between neighbours gets too small to halve meaningfully, the column is
   * renumbered once and the move retried.
   */
  async move(id: string, dto: MoveTaskDto, principal: AuthPrincipal) {
    const task = await this.assertVisible(id, principal);

    const position = await this.positionBetween(
      task.projectId,
      dto.status,
      dto.beforeTaskId,
      dto.afterTaskId,
    );

    const updated = await this.prisma.task.update({
      where: { id },
      data: { position, ...this.statusTransition(dto.status) },
      include: TASK_INCLUDE,
    });

    if (task.status !== dto.status) {
      await this.recalculateProgress(task.projectId);

      await this.audit.record({
        action: 'STATUS_CHANGE',
        entity: 'Task',
        entityId: id,
        before: { status: task.status },
        after: { status: dto.status },
      });

      this.events.emit('task.status_changed', {
        taskId: id,
        organizationId: principal.organizationId,
        projectId: task.projectId,
        from: task.status,
        to: dto.status,
      });
    }

    return this.present(updated);
  }

  async remove(id: string, principal: AuthPrincipal) {
    const task = await this.assertVisible(id, principal);
    await this.prisma.task.delete({ where: { id } });
    await this.recalculateProgress(task.projectId);
    await this.audit.record({ action: 'DELETE', entity: 'Task', entityId: id, before: task });
    return { success: true };
  }

  async addComment(id: string, dto: CreateCommentDto, principal: AuthPrincipal) {
    await this.assertVisible(id, principal);

    const comment = await this.prisma.taskComment.create({
      data: {
        taskId: id,
        authorId: principal.userId,
        body: dto.body,
        mentions: dto.mentions ?? [],
      },
      include: { author: { select: { id: true, name: true, avatarUrl: true } } },
    });

    if (dto.mentions?.length) {
      this.events.emit('task.mentioned', {
        taskId: id,
        organizationId: principal.organizationId,
        mentionedUserIds: dto.mentions,
        byUserId: principal.userId,
      });
    }

    return comment;
  }

  async logTime(id: string, dto: LogTimeDto, principal: AuthPrincipal) {
    await this.assertVisible(id, principal);

    return this.prisma.timeLog.create({
      data: {
        taskId: id,
        userId: principal.userId,
        minutes: dto.minutes,
        note: dto.note,
        billable: dto.billable ?? true,
      },
    });
  }

  // ─── Internals ───────────────────────────────────────────────────────────

  /**
   * Keeps `startedAt` / `completedAt` consistent with the status.
   *
   * Returns a plain shape rather than `Prisma.TaskUpdateInput` so that
   * spreading it alongside scalar foreign keys keeps the payload on Prisma's
   * "unchecked" update variant instead of straddling both.
   */
  private statusTransition(status: TaskStatus): {
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

  private async nextPosition(projectId: string, status: TaskStatus): Promise<number> {
    const last = await this.prisma.task.findFirst({
      where: { projectId, status },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    return (last?.position ?? 0) + POSITION_STEP;
  }

  private async positionBetween(
    projectId: string,
    status: TaskStatus,
    beforeTaskId?: string,
    afterTaskId?: string,
  ): Promise<number> {
    const [before, after] = await Promise.all([
      beforeTaskId
        ? this.prisma.task.findFirst({
            where: { id: beforeTaskId },
            select: { position: true },
          })
        : null,
      afterTaskId
        ? this.prisma.task.findFirst({ where: { id: afterTaskId }, select: { position: true } })
        : null,
    ]);

    // Dropped at the top of the column.
    if (!before && after) return after.position - POSITION_STEP;
    // Dropped at the bottom, or into an empty column.
    if (before && !after) return before.position + POSITION_STEP;

    if (before && after) {
      const gap = Math.abs(after.position - before.position);
      if (gap > 0.001) return (before.position + after.position) / 2;

      // Floats have run out of room between these two cards. Renumber the
      // column once and place the task at the end of it.
      await this.renumberColumn(projectId, status);
      return this.nextPosition(projectId, status);
    }

    return this.nextPosition(projectId, status);
  }

  private async renumberColumn(projectId: string, status: TaskStatus): Promise<void> {
    const tasks = await this.prisma.task.findMany({
      where: { projectId, status },
      orderBy: { position: 'asc' },
      select: { id: true },
    });

    await this.prisma.$transaction(
      tasks.map((task, index) =>
        this.prisma.task.update({
          where: { id: task.id },
          data: { position: (index + 1) * POSITION_STEP },
        }),
      ),
    );
  }

  /** Project progress is derived from task completion, never set by hand. */
  private async recalculateProgress(projectId: string): Promise<void> {
    const [total, done] = await Promise.all([
      this.prisma.task.count({
        where: { projectId, status: { not: TaskStatus.CANCELLED } },
      }),
      this.prisma.task.count({ where: { projectId, status: TaskStatus.DONE } }),
    ]);

    await this.prisma.project.update({
      where: { id: projectId },
      data: { progress: total === 0 ? 0 : Math.round((done / total) * 100) },
    });
  }

  /**
   * Portal users only ever see tasks explicitly marked client-visible, on
   * projects belonging to their own client.
   */
  private visibilityFilter(principal: AuthPrincipal): Prisma.TaskWhereInput {
    if (principal.clientId) {
      return { clientVisible: true, project: { clientId: principal.clientId } };
    }

    return scopeFilter(principal, PERMISSIONS.TASK_READ, {
      ownerField: 'assigneeId',
    }) as Prisma.TaskWhereInput;
  }

  private async assertVisible(id: string, principal: AuthPrincipal) {
    const task = await this.prisma.task.findFirst({
      where: { id, ...this.visibilityFilter(principal) },
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  private present(task: TaskWithRelations) {
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
}
