// ──────────────────────────────────────────────────────────────────────────────
// FILE: pagination.dto.ts
// PURPOSE: High-performance cursor & offset pagination DTO designed for 100M+ users.
// ──────────────────────────────────────────────────────────────────────────────

import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { PaginationMeta, PaginatedResponse } from '../../utils/pagination.util';
import { CacheLevel } from '../../utils/cache.util';

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  // Keyset cursor for ultra-fast deep paging without OFFSET penalty
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsString()
  order?: 'ASC' | 'DESC' = 'DESC';
}

export type { PaginationMeta, PaginatedResponse };

export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMeta;
  isCached?: boolean;
  cacheLevel?: CacheLevel;
}
