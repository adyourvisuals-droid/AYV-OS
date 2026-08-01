import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { Industry, LeadSource, LeadStatus, ServiceType, Temperature } from '@ayv/types';
import { PaginationQueryDto } from '@/common/dto/pagination.dto';

const leadSources = Object.values(LeadSource);
const leadStatuses = Object.values(LeadStatus);
const temperatures = Object.values(Temperature);
const industries = Object.values(Industry);
const serviceTypes = Object.values(ServiceType);

export class CreateLeadDto {
  @ApiProperty({ example: 'Skyline Realty' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({ example: 'Rajesh Kumar' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  contactName?: string;

  @ApiPropertyOptional({ example: 'rajesh@skylinerealty.in' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+919876543210' })
  @IsOptional()
  @IsString()
  @MaxLength(24)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  company?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @ApiPropertyOptional({ enum: leadSources, default: LeadSource.MANUAL })
  @IsOptional()
  @IsIn(leadSources)
  source?: LeadSource;

  @ApiPropertyOptional({ enum: leadStatuses, default: LeadStatus.NEW })
  @IsOptional()
  @IsIn(leadStatuses)
  status?: LeadStatus;

  @ApiPropertyOptional({ enum: temperatures, default: Temperature.WARM })
  @IsOptional()
  @IsIn(temperatures)
  temperature?: Temperature;

  @ApiPropertyOptional({ enum: industries })
  @IsOptional()
  @IsIn(industries)
  industry?: Industry;

  @ApiPropertyOptional({ enum: serviceTypes, isArray: true })
  @IsOptional()
  @IsArray()
  @IsIn(serviceTypes, { each: true })
  services?: ServiceType[];

  @ApiPropertyOptional({ example: 240000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  estimatedValue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}

export class UpdateLeadDto extends PartialType(CreateLeadDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  lostReason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  winReason?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  score?: number;
}

export class MoveLeadStageDto {
  @ApiProperty({ enum: leadStatuses })
  @IsIn(leadStatuses)
  status!: LeadStatus;

  @ApiPropertyOptional({ description: 'Required when moving to LOST.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class AssignLeadDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  ownerId!: string;
}

export class ConvertLeadDto {
  @ApiPropertyOptional({ description: 'Defaults to the lead name.' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  clientName?: string;

  @ApiPropertyOptional({ description: 'Also create a delivery project.', default: true })
  @IsOptional()
  createProject?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  monthlyRetainer?: number;
}

export class LeadQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: leadStatuses })
  @IsOptional()
  @IsIn(leadStatuses)
  status?: LeadStatus;

  @ApiPropertyOptional({ enum: temperatures })
  @IsOptional()
  @IsIn(temperatures)
  temperature?: Temperature;

  @ApiPropertyOptional({ enum: leadSources })
  @IsOptional()
  @IsIn(leadSources)
  source?: LeadSource;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownerId?: string;

  @ApiPropertyOptional({ enum: serviceTypes })
  @IsOptional()
  @IsEnum(ServiceType)
  service?: ServiceType;
}

export class CreateActivityDto {
  @ApiProperty({ example: 'CALL' })
  @IsString()
  @IsNotEmpty()
  type!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(240)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  body?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  outcome?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  durationMinutes?: number;
}
