import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

import { ClientStatus, Industry, ServiceType } from '@ayv/types';
import { PaginationQueryDto } from '@/common/dto/pagination.dto';

const industries = Object.values(Industry);
const serviceTypes = Object.values(ServiceType);
const clientStatuses = Object.values(ClientStatus);

export class CreateClientDto {
  @ApiProperty({ example: 'Skyline Realty' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  legalName?: string;

  @ApiPropertyOptional({ enum: industries })
  @IsOptional()
  @IsIn(industries)
  industry?: Industry;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(24)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  state?: string;

  @ApiPropertyOptional({ description: 'GST state code — decides CGST/SGST vs IGST.' })
  @IsOptional()
  @IsString()
  @MaxLength(4)
  stateCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  gstNumber?: string;

  @ApiPropertyOptional({ enum: serviceTypes, isArray: true })
  @IsOptional()
  @IsArray()
  @IsIn(serviceTypes, { each: true })
  services?: ServiceType[];

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  monthlyRetainer?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accountManagerId?: string;

  @ApiPropertyOptional({ enum: clientStatuses })
  @IsOptional()
  @IsIn(clientStatuses)
  status?: ClientStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  renewalDate?: string;
}

export class UpdateClientDto extends PartialType(CreateClientDto) {}

export class ClientQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: clientStatuses })
  @IsOptional()
  @IsIn(clientStatuses)
  status?: ClientStatus;

  @ApiPropertyOptional({ enum: industries })
  @IsOptional()
  @IsIn(industries)
  industry?: Industry;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accountManagerId?: string;

  @ApiPropertyOptional({ description: 'Only clients with a health score below 60.' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  atRisk?: boolean;
}
