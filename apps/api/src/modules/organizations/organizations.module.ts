import { Body, Controller, Get, Inject, Module, NotFoundException, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

import { PERMISSIONS } from '@ayv/types';
import { CurrentUser, RequirePermission, type AuthPrincipal } from '@/common/decorators';
import { PRISMA, type PrismaService } from '@/infra/prisma/prisma.module';
import { AuditService } from '@/modules/audit/audit.service';

class UpdateOrganizationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) legalName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() logoUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() website?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() addressLine1?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() state?: string;

  @ApiPropertyOptional({ description: 'GST state code — decides CGST/SGST vs IGST.' })
  @IsOptional()
  @IsString()
  @MaxLength(4)
  stateCode?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) gstNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(12) panNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() timezone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() currency?: string;
}

@ApiTags('Organization')
@ApiBearerAuth()
@Controller('organizations')
class OrganizationsController {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get('current')
  @RequirePermission(PERMISSIONS.ORG_READ)
  @ApiOperation({ summary: 'The current organisation profile' })
  async current(@CurrentUser() user: AuthPrincipal) {
    const organization = await this.prisma.organization.findFirst({
      where: { id: user.organizationId },
      include: {
        _count: { select: { users: true, clients: true, projects: true, leads: true } },
      },
    });

    if (!organization) throw new NotFoundException('Organisation not found');

    return {
      ...organization,
      counts: organization._count,
      _count: undefined,
    };
  }

  @Patch('current')
  @RequirePermission(PERMISSIONS.ORG_UPDATE)
  @ApiOperation({ summary: 'Update the organisation profile' })
  async update(@Body() dto: UpdateOrganizationDto, @CurrentUser() user: AuthPrincipal) {
    const before = await this.prisma.organization.findFirst({
      where: { id: user.organizationId },
    });
    if (!before) throw new NotFoundException('Organisation not found');

    const updated = await this.prisma.organization.update({
      where: { id: user.organizationId },
      data: { ...dto },
    });

    await this.audit.record({
      action: 'UPDATE',
      entity: 'Organization',
      entityId: user.organizationId,
      before,
      after: updated,
    });

    return updated;
  }
}

@Module({ controllers: [OrganizationsController] })
export class OrganizationsModule {}
