import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 25;

  @ApiPropertyOptional({
    description: 'Comma-separated fields; prefix with `-` for descending.',
    example: '-createdAt,name',
  })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiPropertyOptional({ description: 'Free-text search across indexed fields.' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Include soft-deleted records. Requires the `:restore` permission.',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  deleted?: boolean;

  get skip(): number {
    return (this.page - 1) * this.limit;
  }

  /**
   * Translates the `sort` string into a Prisma orderBy array.
   * Unknown fields are dropped rather than passed through, so a malformed
   * query parameter cannot produce a database error.
   */
  orderBy(allowedFields: string[], fallback: Record<string, 'asc' | 'desc'>[] = []) {
    if (!this.sort) return fallback;

    const parsed = this.sort
      .split(',')
      .map((token) => token.trim())
      .filter(Boolean)
      .map((token) => {
        const descending = token.startsWith('-');
        const field = descending ? token.slice(1) : token;
        return allowedFields.includes(field)
          ? { [field]: descending ? ('desc' as const) : ('asc' as const) }
          : null;
      })
      .filter((entry): entry is Record<string, 'asc' | 'desc'> => entry !== null);

    return parsed.length > 0 ? parsed : fallback;
  }
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export function paginationMeta(page: number, limit: number, total: number): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}
