import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { PERMISSIONS } from '@ayv/types';
import { CurrentUser, RequirePermission, type AuthPrincipal } from '@/common/decorators';

import {
  CreateCommentDto,
  CreateTaskDto,
  LogTimeDto,
  MoveTaskDto,
  TaskQueryDto,
  UpdateTaskDto,
} from './dto/project.dto';
import { TasksService } from './tasks.service';

@ApiTags('Projects · Tasks')
@ApiBearerAuth()
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  @RequirePermission(PERMISSIONS.TASK_READ)
  @ApiOperation({ summary: 'List tasks' })
  list(@Query() query: TaskQueryDto, @CurrentUser() user: AuthPrincipal) {
    return this.tasks.list(query, user);
  }

  @Get('my')
  @RequirePermission(PERMISSIONS.TASK_READ)
  @ApiOperation({ summary: 'The current user’s open work, ordered by urgency' })
  myTasks(@CurrentUser() user: AuthPrincipal) {
    return this.tasks.myTasks(user);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.TASK_READ)
  @ApiOperation({ summary: 'Task detail with subtasks, comments and time logs' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthPrincipal) {
    return this.tasks.findOne(id, user);
  }

  @Post()
  @RequirePermission(PERMISSIONS.TASK_CREATE)
  @ApiOperation({ summary: 'Create a task' })
  create(@Body() dto: CreateTaskDto, @CurrentUser() user: AuthPrincipal) {
    return this.tasks.create(dto, user);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.TASK_UPDATE)
  @ApiOperation({ summary: 'Update a task' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.tasks.update(id, dto, user);
  }

  @Patch(':id/move')
  @RequirePermission(PERMISSIONS.TASK_UPDATE)
  @ApiOperation({ summary: 'Move a task between board columns and reorder it' })
  move(@Param('id') id: string, @Body() dto: MoveTaskDto, @CurrentUser() user: AuthPrincipal) {
    return this.tasks.move(id, dto, user);
  }

  @Post(':id/comments')
  @RequirePermission(PERMISSIONS.TASK_UPDATE)
  @ApiOperation({ summary: 'Comment on a task' })
  comment(
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.tasks.addComment(id, dto, user);
  }

  @Post(':id/time')
  @RequirePermission(PERMISSIONS.TIMELOG_CREATE)
  @ApiOperation({ summary: 'Log time against a task' })
  logTime(@Param('id') id: string, @Body() dto: LogTimeDto, @CurrentUser() user: AuthPrincipal) {
    return this.tasks.logTime(id, dto, user);
  }

  @Delete(':id')
  @RequirePermission(PERMISSIONS.TASK_DELETE)
  @ApiOperation({ summary: 'Soft delete a task' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthPrincipal) {
    return this.tasks.remove(id, user);
  }
}
