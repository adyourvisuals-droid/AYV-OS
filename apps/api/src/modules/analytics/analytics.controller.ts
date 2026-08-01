import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

import { PERMISSIONS } from '@ayv/types';
import { CurrentUser, RequirePermission, type AuthPrincipal } from '@/common/decorators';

import { AnalyticsService, type DashboardPeriod } from './analytics.service';

class DashboardQueryDto {
  @IsOptional()
  @IsIn(['week', 'month', 'quarter', 'year'])
  period?: DashboardPeriod;
}

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('executive')
  @RequirePermission(PERMISSIONS.DASHBOARD_EXECUTIVE)
  @ApiQuery({ name: 'period', required: false, enum: ['week', 'month', 'quarter', 'year'] })
  @ApiOperation({
    summary: 'Everything a CEO needs to understand the business in 60 seconds',
  })
  executive(@Query() query: DashboardQueryDto, @CurrentUser() user: AuthPrincipal) {
    return this.analytics.executive(user, query.period ?? 'month');
  }

  @Get('sales')
  @RequirePermission(PERMISSIONS.DASHBOARD_READ)
  @ApiQuery({ name: 'period', required: false, enum: ['week', 'month', 'quarter', 'year'] })
  @ApiOperation({ summary: 'Sales dashboard: targets, activity and leaderboard' })
  sales(@Query() query: DashboardQueryDto, @CurrentUser() user: AuthPrincipal) {
    return this.analytics.sales(user, query.period ?? 'month');
  }
}
