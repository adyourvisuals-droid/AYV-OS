import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Prisma } from '@prisma/client';

import { LeadStatus, PERMISSIONS, PIPELINE_STAGES } from '@ayv/types';
import type { AuthPrincipal } from '@/common/decorators';
import { paginationMeta, type Paginated } from '@/common/dto/pagination.dto';
import { scopeFilter } from '@/common/scope/scope.util';
import { PRISMA, type PrismaService } from '@/infra/prisma/prisma.module';
import { AuditService } from '@/modules/audit/audit.service';

import type {
  AssignLeadDto,
  ConvertLeadDto,
  CreateActivityDto,
  CreateLeadDto,
  LeadQueryDto,
  MoveLeadStageDto,
  UpdateLeadDto,
} from './dto/lead.dto';
import { scoreLead, type LeadScoreResult } from './lead-scoring';

const SORTABLE_FIELDS = [
  'createdAt',
  'updatedAt',
  'name',
  'estimatedValue',
  'score',
  'stageChangedAt',
  'lastActivityAt',
];

const LEAD_INCLUDE = {
  owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
} satisfies Prisma.LeadInclude;

type LeadWithOwner = Prisma.LeadGetPayload<{ include: typeof LEAD_INCLUDE }>;

@Injectable()
export class LeadsService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  // ─── Read ────────────────────────────────────────────────────────────────

  async list(query: LeadQueryDto, principal: AuthPrincipal): Promise<Paginated<unknown>> {
    const where: Prisma.LeadWhereInput = {
      ...scopeFilter(principal, PERMISSIONS.LEAD_READ, { ownerField: 'ownerId' }),
      ...(query.status ? { status: query.status } : {}),
      ...(query.temperature ? { temperature: query.temperature } : {}),
      ...(query.source ? { source: query.source } : {}),
      ...(query.ownerId ? { ownerId: query.ownerId } : {}),
      ...(query.service ? { services: { has: query.service } } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { contactName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search } },
              { company: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.deleted ? { deletedAt: { not: null } } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.lead.findMany({
        where,
        include: LEAD_INCLUDE,
        orderBy: query.orderBy(SORTABLE_FIELDS, [{ stageChangedAt: 'desc' }]),
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.lead.count({ where }),
    ]);

    return {
      data: rows.map((row) => this.present(row)),
      meta: paginationMeta(query.page, query.limit, total),
    };
  }

  async findOne(id: string, principal: AuthPrincipal) {
    const lead = await this.prisma.lead.findFirst({
      where: {
        id,
        ...scopeFilter(principal, PERMISSIONS.LEAD_READ, { ownerField: 'ownerId' }),
      },
      include: {
        ...LEAD_INCLUDE,
        stageEvents: { orderBy: { createdAt: 'desc' }, take: 20 },
        _count: { select: { activities: true } },
      },
    });

    if (!lead) throw new NotFoundException('Lead not found');

    return {
      ...this.present(lead),
      activityCount: lead._count.activities,
      stageHistory: lead.stageEvents,
    };
  }

  async timeline(id: string, principal: AuthPrincipal) {
    await this.assertVisible(id, principal);

    return this.prisma.activity.findMany({
      where: { leadId: id },
      include: { actor: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { occurredAt: 'desc' },
      take: 100,
    });
  }

  /** Board payload: leads bucketed by stage with per-column totals. */
  async board(principal: AuthPrincipal) {
    const where: Prisma.LeadWhereInput = {
      ...scopeFilter(principal, PERMISSIONS.LEAD_READ, { ownerField: 'ownerId' }),
      status: { in: PIPELINE_STAGES },
    };

    const leads = await this.prisma.lead.findMany({
      where,
      include: LEAD_INCLUDE,
      orderBy: [{ score: 'desc' }, { stageChangedAt: 'desc' }],
      take: 500,
    });

    return PIPELINE_STAGES.map((stage) => {
      const stageLeads = leads.filter((lead) => lead.status === stage);
      return {
        stage,
        count: stageLeads.length,
        value: stageLeads.reduce((sum, lead) => sum + Number(lead.estimatedValue), 0),
        leads: stageLeads.map((lead) => this.present(lead)),
      };
    });
  }

  async stats(principal: AuthPrincipal) {
    const where = scopeFilter(principal, PERMISSIONS.LEAD_READ, { ownerField: 'ownerId' });

    const [byStage, bySource, aggregate] = await Promise.all([
      this.prisma.lead.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
        _sum: { estimatedValue: true },
      }),
      this.prisma.lead.groupBy({
        by: ['source'],
        where,
        _count: { _all: true },
        _sum: { estimatedValue: true },
      }),
      this.prisma.lead.aggregate({
        where,
        _count: { _all: true },
        _sum: { estimatedValue: true },
        _avg: { score: true },
      }),
    ]);

    const won = byStage.find((row) => row.status === LeadStatus.WON)?._count._all ?? 0;
    const total = aggregate._count._all;

    return {
      total,
      totalValue: Number(aggregate._sum.estimatedValue ?? 0),
      averageScore: Math.round(aggregate._avg.score ?? 0),
      conversionRate: total > 0 ? Number(((won / total) * 100).toFixed(1)) : 0,
      funnel: PIPELINE_STAGES.map((stage) => {
        const row = byStage.find((entry) => entry.status === stage);
        return {
          stage,
          count: row?._count._all ?? 0,
          value: Number(row?._sum.estimatedValue ?? 0),
        };
      }),
      bySource: bySource.map((row) => ({
        source: row.source,
        count: row._count._all,
        value: Number(row._sum.estimatedValue ?? 0),
      })),
    };
  }

  // ─── Write ───────────────────────────────────────────────────────────────

  async create(dto: CreateLeadDto, principal: AuthPrincipal) {
    if (dto.email || dto.phone) {
      const duplicate = await this.prisma.lead.findFirst({
        where: {
          OR: [
            ...(dto.email ? [{ email: dto.email }] : []),
            ...(dto.phone ? [{ phone: dto.phone }] : []),
          ],
        },
        select: { id: true, name: true },
      });

      if (duplicate) {
        throw new BadRequestException(
          `A lead with this contact already exists: ${duplicate.name}`,
        );
      }
    }

    const created = await this.prisma.lead.create({
      data: {
        organizationId: principal.organizationId,
        name: dto.name,
        contactName: dto.contactName,
        email: dto.email?.toLowerCase(),
        phone: dto.phone,
        company: dto.company,
        city: dto.city,
        source: dto.source ?? 'MANUAL',
        status: dto.status ?? 'NEW',
        temperature: dto.temperature ?? 'WARM',
        industry: dto.industry,
        services: dto.services ?? [],
        estimatedValue: dto.estimatedValue ?? 0,
        notes: dto.notes,
        ownerId: dto.ownerId ?? principal.userId,
        createdById: principal.userId,
        stageChangedAt: new Date(),
      },
      include: LEAD_INCLUDE,
    });

    const scored = await this.rescore(created.id);

    await this.prisma.activity.create({
      data: {
        organizationId: principal.organizationId,
        type: 'SYSTEM',
        leadId: created.id,
        actorId: principal.userId,
        title: 'Lead created',
        body: `Captured from ${created.source.toLowerCase().replace(/_/g, ' ')}`,
      },
    });

    await this.audit.record({
      action: 'CREATE',
      entity: 'Lead',
      entityId: created.id,
      after: created,
    });

    // Drives automation A01: assignment, first-contact task, welcome message.
    this.events.emit('lead.created', {
      leadId: created.id,
      organizationId: principal.organizationId,
      source: created.source,
      estimatedValue: Number(created.estimatedValue),
      ownerId: created.ownerId,
    });

    return { ...this.present(created), score: scored.score, temperature: scored.temperature };
  }

  async update(id: string, dto: UpdateLeadDto, principal: AuthPrincipal) {
    const before = await this.assertVisible(id, principal);

    const updated = await this.prisma.lead.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.contactName !== undefined ? { contactName: dto.contactName } : {}),
        ...(dto.email !== undefined ? { email: dto.email?.toLowerCase() } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.company !== undefined ? { company: dto.company } : {}),
        ...(dto.city !== undefined ? { city: dto.city } : {}),
        ...(dto.industry !== undefined ? { industry: dto.industry } : {}),
        ...(dto.services !== undefined ? { services: dto.services } : {}),
        ...(dto.estimatedValue !== undefined ? { estimatedValue: dto.estimatedValue } : {}),
        ...(dto.temperature !== undefined ? { temperature: dto.temperature } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.lostReason !== undefined ? { lostReason: dto.lostReason } : {}),
        ...(dto.winReason !== undefined ? { winReason: dto.winReason } : {}),
        ...(dto.ownerId !== undefined ? { ownerId: dto.ownerId } : {}),
      },
      include: LEAD_INCLUDE,
    });

    await this.rescore(id);
    await this.audit.record({
      action: 'UPDATE',
      entity: 'Lead',
      entityId: id,
      before,
      after: updated,
    });

    return this.present(updated);
  }

  /**
   * Moves a lead between pipeline stages.
   *
   * Records the transition and the time spent in the previous stage, which is
   * what makes stage-velocity analytics possible without reconstructing
   * history from the audit log.
   */
  async moveStage(id: string, dto: MoveLeadStageDto, principal: AuthPrincipal) {
    const lead = await this.assertVisible(id, principal);

    if (lead.status === dto.status) return this.present(lead as LeadWithOwner);

    if (dto.status === LeadStatus.LOST && !dto.reason) {
      throw new BadRequestException('A reason is required when marking a lead as lost');
    }

    const now = new Date();
    const durationHours = Math.max(
      0,
      Math.round((now.getTime() - lead.stageChangedAt.getTime()) / 3_600_000),
    );

    const [updated] = await this.prisma.$transaction([
      this.prisma.lead.update({
        where: { id },
        data: {
          status: dto.status,
          stageChangedAt: now,
          ...(dto.status === LeadStatus.LOST ? { lostReason: dto.reason } : {}),
          ...(dto.status === LeadStatus.WON ? { winReason: dto.reason } : {}),
        },
        include: LEAD_INCLUDE,
      }),
      this.prisma.leadStageEvent.create({
        data: {
          leadId: id,
          fromStage: lead.status,
          toStage: dto.status,
          durationHours,
          actorId: principal.userId,
        },
      }),
      this.prisma.activity.create({
        data: {
          organizationId: principal.organizationId,
          type: 'STAGE_CHANGE',
          leadId: id,
          actorId: principal.userId,
          title: `Moved to ${dto.status}`,
          body: dto.reason,
        },
      }),
    ]);

    await this.rescore(id);
    await this.audit.record({
      action: 'STAGE_CHANGE',
      entity: 'Lead',
      entityId: id,
      before: { status: lead.status },
      after: { status: dto.status },
    });

    this.events.emit('deal.stage_changed', {
      leadId: id,
      organizationId: principal.organizationId,
      from: lead.status,
      to: dto.status,
      durationHours,
    });

    return this.present(updated);
  }

  async assign(id: string, dto: AssignLeadDto, principal: AuthPrincipal) {
    const lead = await this.assertVisible(id, principal);

    const owner = await this.prisma.user.findFirst({
      where: { id: dto.ownerId, status: 'ACTIVE' },
      select: { id: true, name: true },
    });
    if (!owner) throw new NotFoundException('Assignee not found');

    const updated = await this.prisma.lead.update({
      where: { id },
      data: { ownerId: dto.ownerId },
      include: LEAD_INCLUDE,
    });

    await this.prisma.activity.create({
      data: {
        organizationId: principal.organizationId,
        type: 'ASSIGNMENT',
        leadId: id,
        actorId: principal.userId,
        title: `Assigned to ${owner.name}`,
      },
    });

    await this.audit.record({
      action: 'ASSIGN',
      entity: 'Lead',
      entityId: id,
      before: { ownerId: lead.ownerId },
      after: { ownerId: dto.ownerId },
    });

    this.events.emit('lead.assigned', {
      leadId: id,
      organizationId: principal.organizationId,
      ownerId: dto.ownerId,
      previousOwnerId: lead.ownerId,
    });

    return this.present(updated);
  }

  async remove(id: string, principal: AuthPrincipal) {
    const lead = await this.assertVisible(id, principal);
    await this.prisma.lead.delete({ where: { id } });

    await this.audit.record({ action: 'DELETE', entity: 'Lead', entityId: id, before: lead });
    return { success: true };
  }

  async restore(id: string, principal: AuthPrincipal) {
    const lead = await this.prisma.lead.findFirst({ where: { id, deletedAt: { not: null } } });
    if (!lead) throw new NotFoundException('Deleted lead not found');

    const restored = await this.prisma.lead.update({
      where: { id },
      data: { deletedAt: null },
      include: LEAD_INCLUDE,
    });

    await this.audit.record({
      action: 'RESTORE',
      entity: 'Lead',
      entityId: id,
      after: { deletedAt: null },
      actorId: principal.userId,
    });

    return this.present(restored);
  }

  // ─── Activities ──────────────────────────────────────────────────────────

  async addActivity(id: string, dto: CreateActivityDto, principal: AuthPrincipal) {
    await this.assertVisible(id, principal);

    const activity = await this.prisma.activity.create({
      data: {
        organizationId: principal.organizationId,
        leadId: id,
        actorId: principal.userId,
        type: dto.type as never,
        title: dto.title,
        body: dto.body,
        outcome: dto.outcome,
        durationMinutes: dto.durationMinutes,
      },
      include: { actor: { select: { id: true, name: true, avatarUrl: true } } },
    });

    await this.prisma.lead.update({
      where: { id },
      data: { lastActivityAt: new Date() },
    });

    await this.rescore(id);

    this.events.emit('lead.activity_logged', {
      leadId: id,
      organizationId: principal.organizationId,
      type: dto.type,
    });

    return activity;
  }

  // ─── Conversion ──────────────────────────────────────────────────────────

  /**
   * Converts a won lead into a client, and optionally a delivery project.
   *
   * Implements automation A06. The lead row is preserved and linked rather
   * than consumed, so the sales history of every client stays intact.
   */
  async convert(id: string, dto: ConvertLeadDto, principal: AuthPrincipal) {
    const lead = await this.assertVisible(id, principal);

    if (lead.convertedClientId) {
      throw new BadRequestException('This lead has already been converted');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const client = await tx.client.create({
        data: {
          organizationId: principal.organizationId,
          name: dto.clientName ?? lead.name,
          industry: lead.industry,
          email: lead.email,
          phone: lead.phone,
          city: lead.city,
          services: lead.services,
          status: 'ONBOARDING',
          monthlyRetainer: dto.monthlyRetainer ?? null,
          accountManagerId: lead.ownerId,
          contractStartDate: new Date(),
          createdById: principal.userId,
        },
      });

      if (lead.contactName) {
        await tx.clientContact.create({
          data: {
            clientId: client.id,
            name: lead.contactName,
            email: lead.email,
            phone: lead.phone,
            isPrimary: true,
          },
        });
      }

      let project: { id: string; name: string; code: string } | null = null;

      if (dto.createProject !== false) {
        const projectCount = await tx.project.count({
          where: { organizationId: principal.organizationId },
        });

        project = await tx.project.create({
          data: {
            organizationId: principal.organizationId,
            clientId: client.id,
            name: `${client.name} — Onboarding`,
            code: `PRJ-${String(projectCount + 1).padStart(4, '0')}`,
            description: `Delivery project created on conversion of lead "${lead.name}".`,
            status: 'PLANNING',
            services: lead.services,
            managerId: lead.ownerId,
            budget: lead.estimatedValue,
            startDate: new Date(),
            createdById: principal.userId,
          },
          select: { id: true, name: true, code: true },
        });
      }

      await tx.lead.update({
        where: { id },
        data: {
          status: 'WON',
          convertedClientId: client.id,
          convertedAt: new Date(),
          stageChangedAt: new Date(),
        },
      });

      await tx.activity.create({
        data: {
          organizationId: principal.organizationId,
          leadId: id,
          clientId: client.id,
          actorId: principal.userId,
          type: 'SYSTEM',
          title: 'Lead converted to client',
          body: project ? `Client and project ${project.code} created` : 'Client created',
        },
      });

      return { client, project };
    });

    await this.audit.record({
      action: 'CONVERT',
      entity: 'Lead',
      entityId: id,
      after: { clientId: result.client.id, projectId: result.project?.id },
    });

    this.events.emit('lead.converted', {
      leadId: id,
      organizationId: principal.organizationId,
      clientId: result.client.id,
      projectId: result.project?.id,
      value: Number(lead.estimatedValue),
    });

    return {
      clientId: result.client.id,
      clientName: result.client.name,
      projectId: result.project?.id ?? null,
      projectCode: result.project?.code ?? null,
    };
  }

  // ─── Scoring ─────────────────────────────────────────────────────────────

  async rescore(id: string): Promise<LeadScoreResult> {
    const lead = await this.prisma.lead.findFirst({
      where: { id },
      include: { _count: { select: { activities: true } } },
    });
    if (!lead) throw new NotFoundException('Lead not found');

    const result = scoreLead({
      source: lead.source,
      status: lead.status,
      estimatedValue: Number(lead.estimatedValue),
      industry: lead.industry,
      services: lead.services,
      email: lead.email,
      phone: lead.phone,
      contactName: lead.contactName,
      createdAt: lead.createdAt,
      lastActivityAt: lead.lastActivityAt,
      activityCount: lead._count.activities,
    });

    await this.prisma.lead.update({
      where: { id },
      data: {
        score: result.score,
        temperature: result.temperature,
        closeProbability: result.closeProbability,
      },
    });

    return result;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private async assertVisible(id: string, principal: AuthPrincipal) {
    const lead = await this.prisma.lead.findFirst({
      where: {
        id,
        ...scopeFilter(principal, PERMISSIONS.LEAD_READ, { ownerField: 'ownerId' }),
      },
    });

    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  private present(lead: LeadWithOwner) {
    const daysInStage = Math.floor((Date.now() - lead.stageChangedAt.getTime()) / 86_400_000);

    return {
      id: lead.id,
      name: lead.name,
      contactName: lead.contactName,
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
      city: lead.city,
      source: lead.source,
      status: lead.status,
      temperature: lead.temperature,
      industry: lead.industry,
      services: lead.services,
      estimatedValue: Number(lead.estimatedValue),
      currency: lead.currency,
      score: lead.score,
      closeProbability: lead.closeProbability === null ? null : Number(lead.closeProbability),
      notes: lead.notes,
      lostReason: lead.lostReason,
      owner: lead.owner
        ? {
            id: lead.owner.id,
            name: lead.owner.name,
            email: lead.owner.email,
            avatarUrl: lead.owner.avatarUrl,
            initials: this.initials(lead.owner.name),
          }
        : null,
      convertedClientId: lead.convertedClientId,
      stageChangedAt: lead.stageChangedAt.toISOString(),
      daysInStage,
      lastActivityAt: lead.lastActivityAt?.toISOString() ?? null,
      createdAt: lead.createdAt.toISOString(),
      updatedAt: lead.updatedAt.toISOString(),
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
