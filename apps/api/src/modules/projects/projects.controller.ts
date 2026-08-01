import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { PERMISSIONS } from '@ayv/types';
import { CurrentUser, RequirePermission, type AuthPrincipal } from '@/common/decorators';

import { CreateProjectDto, ProjectQueryDto, UpdateProjectDto } from './dto/project.dto';
import { ProjectsService } from './projects.service';
import { TasksService } from './tasks.service';

@ApiTags('Projects')
@ApiBearerAuth()
@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly tasks: TasksService,
  ) {}

  @Get()
  @RequirePermission(PERMISSIONS.PROJECT_READ)
  @ApiOperation({ summary: 'List projects' })
  list(@Query() query: ProjectQueryDto, @CurrentUser() user: AuthPrincipal) {
    return this.projects.list(query, user);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.PROJECT_READ)
  @ApiOperation({ summary: 'Project detail with milestones and task counts' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthPrincipal) {
    return this.projects.findOne(id, user);
  }

  @Get(':id/board')
  @RequirePermission(PERMISSIONS.TASK_READ)
  @ApiOperation({ summary: 'Kanban board for a project' })
  board(@Param('id') id: string, @CurrentUser() user: AuthPrincipal) {
    return this.tasks.board(id, user);
  }

  @Get(':id/health')
  @RequirePermission(PERMISSIONS.PROJECT_READ)
  @ApiOperation({ summary: 'Schedule, budget and throughput risk' })
  health(@Param('id') id: string, @CurrentUser() user: AuthPrincipal) {
    return this.projects.health(id, user);
  }

  @Post()
  @RequirePermission(PERMISSIONS.PROJECT_CREATE)
  @ApiOperation({ summary: 'Create a project' })
  create(@Body() dto: CreateProjectDto, @CurrentUser() user: AuthPrincipal) {
    return this.projects.create(dto, user);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.PROJECT_UPDATE)
  @ApiOperation({ summary: 'Update a project' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.projects.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermission(PERMISSIONS.PROJECT_DELETE)
  @ApiOperation({ summary: 'Soft delete a project' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthPrincipal) {
    return this.projects.remove(id, user);
  }
}
