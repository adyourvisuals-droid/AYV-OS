import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Prisma } from '@prisma/client';

import { PERMISSIONS, TaskStatus } from '@ayv/types';
import type { AuthPrincipal } from '@/common/decorators';
import { paginationMeta, type Paginated } from '@/common/dto/pagination.dto';
import { PRISMA, type PrismaService } from '@/infra/prisma/prisma.module';
import { AuditService } from '@/modules/audit/audit.service';

import type { CreateProjectDto, ProjectQueryDto, UpdateProjectDto } from './dto/project.dto';

const SORTABLE_FIELDS = ['createdAt', 'name', 'dueDate', 'progress', 'priority'];

const PROJECT_INCLUDE = {
  client: { select: { id: true, name: true, logoUrl: true } },
  manager: { select: { id: true, name: true, email: true, avatarUrl: true } },
  members: {
    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
  },
} satisfies Prisma.ProjectInclude;

type ProjectWithRelations = Prisma.ProjectGetPayload<{ include: typeof PROJECT_INCLUDE }>;

/** Roles permitted to see cost and margin. Everyone else gets nulls. */
const FINANCE_VISIBLE_PERMISSION = PERMISSIONS.PNL_READ;

@Injectable()
export class ProjectsService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  async list(query: ProjectQueryDto, principal: AuthPrincipal): Promise<Paginated<unknown>> {
    const where: Prisma.ProjectWhereInput = {
      ...this.visibilityFilter(principal),
      ...(query.status ? { status: query.status } : {}),
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.managerId ? { managerId: query.managerId } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { code: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.deleted ? { deletedAt: { not: null } } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        include: PROJECT_INCLUDE,
        orderBy: query.orderBy(SORTABLE_FIELDS, [{ createdAt: 'desc' }]),
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.project.count({ where }),
    ]);

    return {
      data: rows.map((row) => this.present(row, principal)),
      meta: paginationMeta(query.page, query.limit, total),
    };
  }

  async findOne(id: string, principal: AuthPrincipal) {
    const project = await this.prisma.project.findFirst({
      where: { id, ...this.visibilityFilter(principal) },
      include: {
        ...PROJECT_INCLUDE,
        milestones: { orderBy: { position: 'asc' } },
      },
    });

    if (!project) throw new NotFoundException('Project not found');

    const taskCounts = await this.taskCounts(id);

    return {
      ...this.present(project, principal),
      milestones: project.milestones,
      taskCounts,
    };
  }

  async create(dto: CreateProjectDto, principal: AuthPrincipal) {
    const code = await this.nextProjectCode(principal.organizationId);

    const created = await this.prisma.project.create({
      data: {
        organizationId: principal.organizationId,
        name: dto.name,
        code,
        description: dto.description,
        clientId: dto.clientId,
        managerId: dto.managerId ?? principal.userId,
        status: dto.status ?? 'PLANNING',
        priority: dto.priority ?? 'MEDIUM',
        services: dto.services ?? [],
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        budget: dto.budget,
        internalCost: dto.internalCost,
        createdById: principal.userId,
        members: dto.memberIds?.length
          ? { create: dto.memberIds.map((userId) => ({ userId })) }
          : undefined,
      },
      include: PROJECT_INCLUDE,
    });

    await this.audit.record({
      action: 'CREATE',
      entity: 'Project',
      entityId: created.id,
      after: created,
    });

    this.events.emit('project.created', {
      projectId: created.id,
      organizationId: principal.organizationId,
      clientId: created.clientId,
    });

    return this.present(created, principal);
  }

  async update(id: string, dto: UpdateProjectDto, principal: AuthPrincipal) {
    const before = await this.assertVisible(id, principal);

    const updated = await this.prisma.project.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.clientId !== undefined ? { clientId: dto.clientId } : {}),
        ...(dto.managerId !== undefined ? { managerId: dto.managerId } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.services !== undefined ? { services: dto.services } : {}),
        ...(dto.startDate !== undefined
          ? { startDate: dto.startDate ? new Date(dto.startDate) : null }
          : {}),
        ...(dto.dueDate !== undefined
          ? { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }
          : {}),
        ...(dto.budget !== undefined ? { budget: dto.budget } : {}),
        ...(dto.internalCost !== undefined ? { internalCost: dto.internalCost } : {}),
        ...(dto.status !== undefined
          ? {
              status: dto.status,
              completedAt: dto.status === 'COMPLETED' ? new Date() : null,
            }
          : {}),
      },
      include: PROJECT_INCLUDE,
    });

    await this.audit.record({
      action: 'UPDATE',
      entity: 'Project',
      entityId: id,
      before,
      after: updated,
    });

    if (dto.status === 'COMPLETED') {
      this.events.emit('project.completed', {
        projectId: id,
        organizationId: principal.organizationId,
        clientId: updated.clientId,
      });
    }

    return this.present(updated, principal);
  }

  async remove(id: string, principal: AuthPrincipal) {
    const before = await this.assertVisible(id, principal);
    await this.prisma.project.delete({ where: { id } });
    await this.audit.record({ action: 'DELETE', entity: 'Project', entityId: id, before });
    return { success: true };
  }

  /**
   * Schedule, budget and throughput risk for a single project.
   *
   * The schedule signal is the one that matters most in an agency: elapsed
   * time far ahead of completed work is how a project quietly becomes late.
   */
  async health(id: string, principal: AuthPrincipal) {
    const project = await this.assertVisible(id, principal);
    const taskCounts = await this.taskCounts(id);

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

    if (taskCounts.BLOCKED > 0) {
      risks.push({
        type: 'BLOCKED',
        severity: taskCounts.BLOCKED > 2 ? 'HIGH' : 'MEDIUM',
        message: `${taskCounts.BLOCKED} task(s) blocked`,
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

    return {
      projectId: id,
      progress: project.progress,
      taskCounts,
      risks,
      status:
        risks.some((risk) => risk.severity === 'HIGH')
          ? 'AT_RISK'
          : risks.length > 0
            ? 'WATCH'
            : 'ON_TRACK',
    };
  }

  // ─── Internals ───────────────────────────────────────────────────────────

  private async taskCounts(projectId: string): Promise<Record<TaskStatus, number>> {
    const grouped = await this.prisma.task.groupBy({
      by: ['status'],
      where: { projectId },
      _count: { _all: true },
    });

    const counts = Object.fromEntries(
      Object.values(TaskStatus).map((status) => [status, 0]),
    ) as Record<TaskStatus, number>;

    for (const row of grouped) {
      counts[row.status as TaskStatus] = row._count._all;
    }

    return counts;
  }

  private async nextProjectCode(organizationId: string): Promise<string> {
    const count = await this.prisma.project.count({
      where: { organizationId, deletedAt: undefined },
    });
    return `PRJ-${String(count + 1).padStart(4, '0')}`;
  }

  private visibilityFilter(principal: AuthPrincipal): Prisma.ProjectWhereInput {
    if (principal.clientId) return { clientId: principal.clientId };

    const scope = principal.permissionScopes[PERMISSIONS.PROJECT_READ] ?? 'OWN';
    if (scope === 'ALL') return {};

    // A project is visible to anyone managing it or assigned to it — team
    // membership on the project itself is the meaningful boundary here, not
    // the org chart.
    return {
      OR: [
        { managerId: principal.userId },
        { members: { some: { userId: principal.userId } } },
        { tasks: { some: { assigneeId: principal.userId } } },
      ],
    };
  }

  private async assertVisible(id: string, principal: AuthPrincipal) {
    const project = await this.prisma.project.findFirst({
      where: { id, ...this.visibilityFilter(principal) },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  private present(project: ProjectWithRelations, principal: AuthPrincipal) {
    const canSeeFinancials = principal.permissions.includes(FINANCE_VISIBLE_PERMISSION);

    const budget = project.budget === null ? null : Number(project.budget);
    const internalCost = project.internalCost === null ? null : Number(project.internalCost);
    const margin =
      budget !== null && internalCost !== null && budget > 0
        ? Number((((budget - internalCost) / budget) * 100).toFixed(1))
        : null;

    return {
      id: project.id,
      name: project.name,
      code: project.code,
      description: project.description,
      status: project.status,
      priority: project.priority,
      services: project.services,
      progress: project.progress,
      client: project.client,
      manager: project.manager
        ? { ...project.manager, initials: this.initials(project.manager.name) }
        : null,
      members: project.members.map((member) => ({
        ...member.user,
        initials: this.initials(member.user.name),
        allocation: member.allocation,
      })),
      startDate: project.startDate?.toISOString() ?? null,
      dueDate: project.dueDate?.toISOString() ?? null,
      completedAt: project.completedAt?.toISOString() ?? null,
      currency: project.currency,
      // Field-level redaction: stripped from the payload, not merely hidden
      // in the UI.
      budget: canSeeFinancials ? budget : null,
      internalCost: canSeeFinancials ? internalCost : null,
      margin: canSeeFinancials ? margin : null,
      createdAt: project.createdAt.toISOString(),
    };
  }

  private initials(name: string): string {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }
}
