import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { PERMISSIONS } from '@ayv/types';
import { CurrentUser, RequirePermission, type AuthPrincipal } from '@/common/decorators';

import {
  AssignLeadDto,
  ConvertLeadDto,
  CreateActivityDto,
  CreateLeadDto,
  LeadQueryDto,
  MoveLeadStageDto,
  UpdateLeadDto,
} from './dto/lead.dto';
import { LeadsService } from './leads.service';

@ApiTags('CRM · Leads')
@ApiBearerAuth()
@Controller('crm/leads')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.LEAD_READ)
  @ApiOperation({ summary: 'List leads, scoped to the actor’s permission' })
  list(@Query() query: LeadQueryDto, @CurrentUser() user: AuthPrincipal) {
    return this.leads.list(query, user);
  }

  @Get('board')
  @RequirePermission(PERMISSIONS.LEAD_READ)
  @ApiOperation({ summary: 'Pipeline board grouped by stage with column totals' })
  board(@CurrentUser() user: AuthPrincipal) {
    return this.leads.board(user);
  }

  @Get('stats')
  @RequirePermission(PERMISSIONS.LEAD_READ)
  @ApiOperation({ summary: 'Funnel counts, conversion rate and source breakdown' })
  stats(@CurrentUser() user: AuthPrincipal) {
    return this.leads.stats(user);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.LEAD_READ)
  @ApiOperation({ summary: 'Lead detail with stage history' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthPrincipal) {
    return this.leads.findOne(id, user);
  }

  @Get(':id/timeline')
  @RequirePermission(PERMISSIONS.LEAD_READ)
  @ApiOperation({ summary: 'Unified activity stream for a lead' })
  timeline(@Param('id') id: string, @CurrentUser() user: AuthPrincipal) {
    return this.leads.timeline(id, user);
  }

  @Post()
  @RequirePermission(PERMISSIONS.LEAD_CREATE)
  @ApiOperation({ summary: 'Create a lead — fires the intake automation' })
  create(@Body() dto: CreateLeadDto, @CurrentUser() user: AuthPrincipal) {
    return this.leads.create(dto, user);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.LEAD_UPDATE)
  @ApiOperation({ summary: 'Update a lead' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.leads.update(id, dto, user);
  }

  @Patch(':id/stage')
  @RequirePermission(PERMISSIONS.LEAD_UPDATE)
  @ApiOperation({ summary: 'Move a lead between pipeline stages' })
  moveStage(
    @Param('id') id: string,
    @Body() dto: MoveLeadStageDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.leads.moveStage(id, dto, user);
  }

  @Patch(':id/assign')
  @RequirePermission(PERMISSIONS.LEAD_ASSIGN)
  @ApiOperation({ summary: 'Reassign lead ownership' })
  assign(
    @Param('id') id: string,
    @Body() dto: AssignLeadDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.leads.assign(id, dto, user);
  }

  @Post(':id/activities')
  @RequirePermission(PERMISSIONS.ACTIVITY_CREATE)
  @ApiOperation({ summary: 'Log a call, meeting, email or note' })
  addActivity(
    @Param('id') id: string,
    @Body() dto: CreateActivityDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.leads.addActivity(id, dto, user);
  }

  @Post(':id/score')
  @HttpCode(200)
  @RequirePermission(PERMISSIONS.LEAD_UPDATE)
  @ApiOperation({ summary: 'Recompute the lead score and return the factors' })
  score(@Param('id') id: string) {
    return this.leads.rescore(id);
  }

  @Post(':id/convert')
  @RequirePermission(PERMISSIONS.LEAD_CONVERT)
  @ApiOperation({ summary: 'Convert a won lead into a client and delivery project' })
  convert(
    @Param('id') id: string,
    @Body() dto: ConvertLeadDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.leads.convert(id, dto, user);
  }

  @Delete(':id')
  @RequirePermission(PERMISSIONS.LEAD_DELETE)
  @ApiOperation({ summary: 'Soft delete a lead' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthPrincipal) {
    return this.leads.remove(id, user);
  }

  @Post(':id/restore')
  @HttpCode(200)
  @RequirePermission(PERMISSIONS.LEAD_RESTORE)
  @ApiOperation({ summary: 'Restore a soft-deleted lead' })
  restore(@Param('id') id: string, @CurrentUser() user: AuthPrincipal) {
    return this.leads.restore(id, user);
  }
}
