import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Prisma } from '@prisma/client';

import { PERMISSIONS } from '@ayv/types';
import type { AuthPrincipal } from '@/common/decorators';
import { paginationMeta, type Paginated } from '@/common/dto/pagination.dto';
import { scopeFilter } from '@/common/scope/scope.util';
import { PRISMA, type PrismaService } from '@/infra/prisma/prisma.module';
import { AuditService } from '@/modules/audit/audit.service';

import { computeClientHealth, type HealthResult } from './client-health';
import type { ClientQueryDto, CreateClientDto, UpdateClientDto } from './dto/client.dto';

const SORTABLE_FIELDS = ['createdAt', 'name', 'healthScore', 'renewalDate', 'monthlyRetainer'];

const CLIENT_INCLUDE = {
  accountManager: { select: { id: true, name: true, email: true, avatarUrl: true } },
} satisfies Prisma.ClientInclude;

type ClientWithManager = Prisma.ClientGetPayload<{ include: typeof CLIENT_INCLUDE }>;

@Injectable()
export class ClientsService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  async list(query: ClientQueryDto, principal: AuthPrincipal): Promise<Paginated<unknown>> {
    const where: Prisma.ClientWhereInput = {
      ...this.visibilityFilter(principal),
      ...(query.status ? { status: query.status } : {}),
      ...(query.industry ? { industry: query.industry } : {}),
      ...(query.accountManagerId ? { accountManagerId: query.accountManagerId } : {}),
      ...(query.atRisk ? { healthScore: { lt: 60 } } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { legalName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.deleted ? { deletedAt: { not: null } } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        include: CLIENT_INCLUDE,
        orderBy: query.orderBy(SORTABLE_FIELDS, [{ createdAt: 'desc' }]),
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.client.count({ where }),
    ]);

    return {
      data: rows.map((row) => this.present(row)),
      meta: paginationMeta(query.page, query.limit, total),
    };
  }

  async findOne(id: string, principal: AuthPrincipal) {
    const client = await this.prisma.client.findFirst({
      where: { id, ...this.visibilityFilter(principal) },
      include: {
        ...CLIENT_INCLUDE,
        contacts: { orderBy: { isPrimary: 'desc' } },
        _count: { select: { projects: true, invoices: true, tickets: true } },
      },
    });

    if (!client) throw new NotFoundException('Client not found');

    return {
      ...this.present(client),
      contacts: client.contacts,
      counts: {
        projects: client._count.projects,
        invoices: client._count.invoices,
        tickets: client._count.tickets,
      },
    };
  }

  async create(dto: CreateClientDto, principal: AuthPrincipal) {
    const created = await this.prisma.client.create({
      data: {
        organizationId: principal.organizationId,
        name: dto.name,
        legalName: dto.legalName,
        industry: dto.industry,
        email: dto.email?.toLowerCase(),
        phone: dto.phone,
        website: dto.website,
        city: dto.city,
        state: dto.state,
        stateCode: dto.stateCode,
        gstNumber: dto.gstNumber,
        services: dto.services ?? [],
        monthlyRetainer: dto.monthlyRetainer,
        accountManagerId: dto.accountManagerId ?? principal.userId,
        status: dto.status ?? 'ONBOARDING',
        renewalDate: dto.renewalDate ? new Date(dto.renewalDate) : null,
        createdById: principal.userId,
      },
      include: CLIENT_INCLUDE,
    });

    await this.audit.record({
      action: 'CREATE',
      entity: 'Client',
      entityId: created.id,
      after: created,
    });

    this.events.emit('client.created', {
      clientId: created.id,
      organizationId: principal.organizationId,
    });

    return this.present(created);
  }

  async update(id: string, dto: UpdateClientDto, principal: AuthPrincipal) {
    const before = await this.assertVisible(id, principal);

    const updated = await this.prisma.client.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.legalName !== undefined ? { legalName: dto.legalName } : {}),
        ...(dto.industry !== undefined ? { industry: dto.industry } : {}),
        ...(dto.email !== undefined ? { email: dto.email?.toLowerCase() } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.website !== undefined ? { website: dto.website } : {}),
        ...(dto.city !== undefined ? { city: dto.city } : {}),
        ...(dto.state !== undefined ? { state: dto.state } : {}),
        ...(dto.stateCode !== undefined ? { stateCode: dto.stateCode } : {}),
        ...(dto.gstNumber !== undefined ? { gstNumber: dto.gstNumber } : {}),
        ...(dto.services !== undefined ? { services: dto.services } : {}),
        ...(dto.monthlyRetainer !== undefined ? { monthlyRetainer: dto.monthlyRetainer } : {}),
        ...(dto.accountManagerId !== undefined
          ? { accountManagerId: dto.accountManagerId }
          : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.renewalDate !== undefined
          ? { renewalDate: dto.renewalDate ? new Date(dto.renewalDate) : null }
          : {}),
      },
      include: CLIENT_INCLUDE,
    });

    await this.audit.record({
      action: 'UPDATE',
      entity: 'Client',
      entityId: id,
      before,
      after: updated,
    });

    return this.present(updated);
  }

  async remove(id: string, principal: AuthPrincipal) {
    const before = await this.assertVisible(id, principal);
    await this.prisma.client.delete({ where: { id } });
    await this.audit.record({ action: 'DELETE', entity: 'Client', entityId: id, before });
    return { success: true };
  }

  // ─── Health ──────────────────────────────────────────────────────────────

  /**
   * Recomputes the health score from live data and persists both the
   * denormalised score and a snapshot with per-signal attribution.
   */
  async computeHealth(id: string, principal: AuthPrincipal): Promise<HealthResult> {
    await this.assertVisible(id, principal);

    const [invoices, projects, tickets, portalUsers] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { clientId: id },
        select: { status: true, dueDate: true, paidAt: true },
      }),
      this.prisma.project.findMany({
        where: { clientId: id },
        select: { status: true, dueDate: true, completedAt: true },
      }),
      this.prisma.ticket.findMany({
        where: { clientId: id, status: { notIn: ['RESOLVED', 'CLOSED'] } },
        select: { createdAt: true },
      }),
      this.prisma.user.findMany({
        where: { clientId: id },
        select: { lastActiveAt: true },
      }),
    ]);

    const paymentDelays = invoices
      .filter((invoice) => invoice.paidAt)
      .map((invoice) =>
        Math.round((invoice.paidAt!.getTime() - invoice.dueDate.getTime()) / 86_400_000),
      );

    const overdueInvoiceCount = invoices.filter(
      (invoice) =>
        invoice.status !== 'PAID' && invoice.status !== 'CANCELLED' && invoice.dueDate < new Date(),
    ).length;

    const completedProjects = projects.filter((project) => project.completedAt);
    const onTimeProjects = completedProjects.filter(
      (project) => !project.dueDate || project.completedAt! <= project.dueDate,
    );

    const thirtyDaysAgo = Date.now() - 30 * 86_400_000;
    const recentLogins = portalUsers.filter(
      (user) => user.lastActiveAt && user.lastActiveAt.getTime() > thirtyDaysAgo,
    ).length;

    const oldestTicket = tickets.reduce<number>((oldest, ticket) => {
      const age = Math.floor((Date.now() - ticket.createdAt.getTime()) / 86_400_000);
      return Math.max(oldest, age);
    }, 0);

    const result = computeClientHealth({
      paymentDelays,
      overdueInvoiceCount,
      // Communication and satisfaction land with the messaging and CSAT
      // modules in Phase 3; until then these signals score as neutral.
      medianResponseHours: null,
      medianApprovalHours: null,
      projectsDelivered: completedProjects.length,
      projectsDeliveredOnTime: onTimeProjects.length,
      satisfactionRatings: [],
      openTicketCount: tickets.length,
      oldestOpenTicketDays: oldestTicket,
      recentLogins,
    });

    const signalScore = (key: string) =>
      result.signals.find((signal) => signal.key === key)?.score ?? 0;

    await this.prisma.$transaction([
      this.prisma.client.update({
        where: { id },
        data: { healthScore: result.score, healthUpdatedAt: new Date() },
      }),
      this.prisma.clientHealthSnapshot.create({
        data: {
          clientId: id,
          score: result.score,
          paymentScore: signalScore('payment'),
          communicationScore: signalScore('communication'),
          approvalScore: signalScore('approval'),
          deliveryScore: signalScore('delivery'),
          satisfactionScore: signalScore('satisfaction'),
          supportScore: signalScore('support'),
          engagementScore: signalScore('engagement'),
          signals: result.signals as unknown as Prisma.InputJsonValue,
        },
      }),
    ]);

    if (result.score < 60) {
      this.events.emit('client.health_declined', {
        clientId: id,
        organizationId: principal.organizationId,
        score: result.score,
        band: result.band,
      });
    }

    return result;
  }

  async healthHistory(id: string, principal: AuthPrincipal) {
    await this.assertVisible(id, principal);

    return this.prisma.clientHealthSnapshot.findMany({
      where: { clientId: id },
      orderBy: { computedAt: 'desc' },
      take: 90,
    });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  /**
   * Portal users are hard-scoped to their own client row, on top of whatever
   * the permission scope would otherwise allow.
   */
  private visibilityFilter(principal: AuthPrincipal): Prisma.ClientWhereInput {
    if (principal.clientId) return { id: principal.clientId };

    return scopeFilter(principal, PERMISSIONS.CLIENT_READ, {
      ownerField: 'accountManagerId',
    }) as Prisma.ClientWhereInput;
  }

  private async assertVisible(id: string, principal: AuthPrincipal) {
    const client = await this.prisma.client.findFirst({
      where: { id, ...this.visibilityFilter(principal) },
    });
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  private present(client: ClientWithManager) {
    return {
      id: client.id,
      name: client.name,
      legalName: client.legalName,
      logoUrl: client.logoUrl,
      industry: client.industry,
      status: client.status,
      healthScore: client.healthScore,
      healthUpdatedAt: client.healthUpdatedAt?.toISOString() ?? null,
      email: client.email,
      phone: client.phone,
      website: client.website,
      city: client.city,
      services: client.services,
      monthlyRetainer:
        client.monthlyRetainer === null ? null : Number(client.monthlyRetainer),
      currency: client.currency,
      accountManager: client.accountManager
        ? {
            id: client.accountManager.id,
            name: client.accountManager.name,
            email: client.accountManager.email,
            avatarUrl: client.accountManager.avatarUrl,
            initials: client.accountManager.name
              .split(/\s+/)
              .slice(0, 2)
              .map((part) => part[0]?.toUpperCase() ?? '')
              .join(''),
          }
        : null,
      contractStartDate: client.contractStartDate?.toISOString() ?? null,
      renewalDate: client.renewalDate?.toISOString() ?? null,
      createdAt: client.createdAt.toISOString(),
    };
  }
}
