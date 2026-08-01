import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

import { Priority, ProjectStatus, ServiceType, TaskStatus } from '@ayv/types';
import { PaginationQueryDto } from '@/common/dto/pagination.dto';

const projectStatuses = Object.values(ProjectStatus);
const taskStatuses = Object.values(TaskStatus);
const priorities = Object.values(Priority);
const serviceTypes = Object.values(ServiceType);

export class CreateProjectDto {
  @ApiProperty({ example: 'Q3 Brand Campaign' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  managerId?: string;

  @ApiPropertyOptional({ enum: projectStatuses })
  @IsOptional()
  @IsIn(projectStatuses)
  status?: ProjectStatus;

  @ApiPropertyOptional({ enum: priorities })
  @IsOptional()
  @IsIn(priorities)
  priority?: Priority;

  @ApiPropertyOptional({ enum: serviceTypes, isArray: true })
  @IsOptional()
  @IsArray()
  @IsIn(serviceTypes, { each: true })
  services?: ServiceType[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budget?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  internalCost?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  memberIds?: string[];
}

export class UpdateProjectDto extends PartialType(CreateProjectDto) {}

export class ProjectQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: projectStatuses })
  @IsOptional()
  @IsIn(projectStatuses)
  status?: ProjectStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  managerId?: string;
}

export class CreateTaskDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  projectId!: string;

  @ApiProperty({ example: 'Design the launch carousel' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(240)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  description?: string;

  @ApiPropertyOptional({ enum: taskStatuses })
  @IsOptional()
  @IsIn(taskStatuses)
  status?: TaskStatus;

  @ApiPropertyOptional({ enum: priorities })
  @IsOptional()
  @IsIn(priorities)
  priority?: Priority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assigneeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parentTaskId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  estimatedHours?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  labels?: string[];

  @ApiPropertyOptional({ description: 'Show this task in the client portal.' })
  @IsOptional()
  @IsBoolean()
  clientVisible?: boolean;
}

export class UpdateTaskDto extends PartialType(CreateTaskDto) {
  @IsOptional()
  @IsString()
  declare projectId: string;
}

export class MoveTaskDto {
  @ApiProperty({ enum: taskStatuses })
  @IsIn(taskStatuses)
  status!: TaskStatus;

  @ApiPropertyOptional({ description: 'Id of the task this one lands above.' })
  @IsOptional()
  @IsString()
  beforeTaskId?: string;

  @ApiPropertyOptional({ description: 'Id of the task this one lands below.' })
  @IsOptional()
  @IsString()
  afterTaskId?: string;
}

export class TaskQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiPropertyOptional({ enum: taskStatuses })
  @IsOptional()
  @IsIn(taskStatuses)
  status?: TaskStatus;

  @ApiPropertyOptional({ enum: priorities })
  @IsOptional()
  @IsIn(priorities)
  priority?: Priority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assigneeId?: string;
}

export class LogTimeDto {
  @ApiProperty({ example: 90 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  minutes!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  billable?: boolean;
}

export class CreateCommentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  body!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mentions?: string[];
}
