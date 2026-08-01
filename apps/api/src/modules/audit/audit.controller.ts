import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

import { PERMISSIONS } from '@ayv/types';
import { RequirePermission } from '@/common/decorators';
import { PaginationQueryDto, paginationMeta } from '@/common/dto/pagination.dto';
import { PRISMA, type PrismaService } from '@/infra/prisma/prisma.module';

class AuditQueryDto extends PaginationQueryDto {
  @IsOptional() @IsString() entity?: string;
  @IsOptional() @IsString() entityId?: string;
  @IsOptional() @IsString() actorId?: string;
  @IsOptional() @IsString() action?: string;
}

@ApiTags('Audit')
@Controller('audit')
export class AuditController {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission(PERMISSIONS.AUDIT_READ)
  @ApiOperation({ summary: 'Query the immutable activity log' })
  async list(@Query() query: AuditQueryDto) {
    const where = {
      ...(query.entity ? { entity: query.entity } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.action ? { action: query.action } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { actor: { select: { id: true, name: true, avatarUrl: true } } },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data: rows, meta: paginationMeta(query.page, query.limit, total) };
  }
}
