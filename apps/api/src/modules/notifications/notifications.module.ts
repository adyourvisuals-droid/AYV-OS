import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Injectable,
  Module,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

import { CurrentUser, type AuthPrincipal } from '@/common/decorators';
import { PaginationQueryDto, paginationMeta } from '@/common/dto/pagination.dto';
import { PRISMA, type PrismaService } from '@/infra/prisma/prisma.module';

class NotificationQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  unread?: boolean;
}

export interface CreateNotificationInput {
  organizationId: string;
  userId: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
  severity?: 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL';
  entityType?: string;
  entityId?: string;
}

/**
 * Notification fan-out.
 *
 * Phase 1 delivers in-app only. Email, WhatsApp and push are added as
 * additional channels behind the same `dispatch` call in Phase 3, so nothing
 * that emits a notification needs to change.
 */
@Injectable()
export class NotificationsService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaService) {}

  async dispatch(input: CreateNotificationInput) {
    return this.prisma.notification.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        link: input.link,
        severity: input.severity ?? 'INFO',
        entityType: input.entityType,
        entityId: input.entityId,
        channels: ['IN_APP'],
        sentAt: new Date(),
      },
    });
  }

  async list(userId: string, query: PaginationQueryDto, unreadOnly: boolean) {
    const where = { userId, ...(unreadOnly ? { readAt: null } : {}) };

    const [rows, total, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);

    return {
      data: rows,
      meta: { ...paginationMeta(query.page, query.limit, total), unread },
    };
  }

  async markRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { success: true };
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { success: true, marked: result.count };
  }

  // ─── Event listeners ─────────────────────────────────────────────────────

  @OnEvent('lead.assigned')
  async onLeadAssigned(payload: {
    leadId: string;
    organizationId: string;
    ownerId: string;
    previousOwnerId: string | null;
  }) {
    if (!payload.ownerId || payload.ownerId === payload.previousOwnerId) return;

    const lead = await this.prisma.lead.findFirst({
      where: { id: payload.leadId },
      select: { name: true, estimatedValue: true },
    });

    await this.dispatch({
      organizationId: payload.organizationId,
      userId: payload.ownerId,
      type: 'LEAD_ASSIGNED',
      title: `New lead assigned: ${lead?.name ?? 'Lead'}`,
      body: lead ? `Estimated value ₹${Number(lead.estimatedValue).toLocaleString('en-IN')}` : undefined,
      link: `/crm/leads/${payload.leadId}`,
      entityType: 'Lead',
      entityId: payload.leadId,
    });
  }

  @OnEvent('task.created')
  async onTaskCreated(payload: {
    taskId: string;
    organizationId: string;
    assigneeId: string | null;
  }) {
    if (!payload.assigneeId) return;

    const task = await this.prisma.task.findFirst({
      where: { id: payload.taskId },
      select: { title: true, dueDate: true },
    });

    await this.dispatch({
      organizationId: payload.organizationId,
      userId: payload.assigneeId,
      type: 'TASK_ASSIGNED',
      title: `New task: ${task?.title ?? 'Task'}`,
      body: task?.dueDate ? `Due ${task.dueDate.toDateString()}` : undefined,
      link: `/tasks/${payload.taskId}`,
      entityType: 'Task',
      entityId: payload.taskId,
    });
  }

  @OnEvent('task.mentioned')
  async onMentioned(payload: {
    taskId: string;
    organizationId: string;
    mentionedUserIds: string[];
  }) {
    await Promise.all(
      payload.mentionedUserIds.map((userId) =>
        this.dispatch({
          organizationId: payload.organizationId,
          userId,
          type: 'MENTION',
          title: 'You were mentioned in a comment',
          link: `/tasks/${payload.taskId}`,
          entityType: 'Task',
          entityId: payload.taskId,
        }),
      ),
    );
  }

  @OnEvent('client.health_declined')
  async onClientHealthDeclined(payload: {
    clientId: string;
    organizationId: string;
    score: number;
    band: string;
  }) {
    const client = await this.prisma.client.findFirst({
      where: { id: payload.clientId },
      select: { name: true, accountManagerId: true },
    });

    if (!client?.accountManagerId) return;

    await this.dispatch({
      organizationId: payload.organizationId,
      userId: client.accountManagerId,
      type: 'CLIENT_HEALTH',
      title: `${client.name} health dropped to ${payload.score}`,
      body: 'Review the account and plan a recovery action.',
      link: `/clients/${payload.clientId}`,
      severity: payload.band === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
      entityType: 'Client',
      entityId: payload.clientId,
    });
  }
}

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List notifications for the current user' })
  list(@CurrentUser('userId') userId: string, @Query() query: NotificationQueryDto) {
    return this.notifications.list(userId, query, query.unread === true);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  markRead(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.notifications.markRead(userId, id);
  }

  @Post('read-all')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark every notification as read' })
  markAllRead(@CurrentUser() user: AuthPrincipal) {
    return this.notifications.markAllRead(user.userId);
  }
}

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
