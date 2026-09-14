// ──────────────────────────────────────────────────────────────────────────────
// FILE: pagination.util.ts
// PURPOSE: Modular, high-performance pagination calculation and response builder.
//          - Sanitizes & clamps query inputs (page, limit, order, sortBy)
//          - Calculates offset/skip & take for TypeORM and raw queries
//          - Standardizes paginated response with metadata and cache tier indicator
// ──────────────────────────────────────────────────────────────────────────────

import { CacheLevel } from './cache.util';

export interface PaginationOptions {
  page?: number | string | undefined;
  limit?: number | string | undefined;
  maxLimit?: number | undefined;
  defaultLimit?: number | undefined;
  sortBy?: string | undefined;
  order?: 'ASC' | 'DESC' | undefined;
  cursor?: string | undefined;
}

export interface NormalizedPagination {
  page: number;
  limit: number;
  skip: number;
  take: number;
  sortBy: string;
  order: 'ASC' | 'DESC';
  cursor?: string | undefined;
}

export interface PaginationMeta {
  totalItems: number;
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  nextCursor?: string | undefined;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
  isCached?: boolean | undefined;
  cacheLevel?: CacheLevel | undefined;
}

export class PaginationUtil {
  /**
   * Sanitizes, clamps, and normalizes pagination query parameters.
   */
  public static normalize(options: PaginationOptions = {}): NormalizedPagination {
    const rawPage = typeof options.page === 'string' ? parseInt(options.page, 10) : options.page;
    const rawLimit =
      typeof options.limit === 'string' ? parseInt(options.limit, 10) : options.limit;

    const maxLimit = options.maxLimit || 100;
    const defaultLimit = options.defaultLimit || 20;

    const page = !rawPage || isNaN(rawPage) || rawPage < 1 ? 1 : Math.floor(rawPage);
    const limit =
      !rawLimit || isNaN(rawLimit) || rawLimit < 1
        ? defaultLimit
        : Math.min(Math.floor(rawLimit), maxLimit);

    const skip = (page - 1) * limit;
    const take = limit;

    const sortBy = options.sortBy || 'createdAt';
    const order = options.order?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const result: NormalizedPagination = {
      page,
      limit,
      skip,
      take,
      sortBy,
      order,
    };

    if (options.cursor !== undefined) {
      result.cursor = options.cursor;
    }

    return result;
  }

  /**
   * Builds standardized pagination metadata from raw counts and pages.
   */
  public static buildMeta(
    totalItems: number,
    page: number,
    limit: number,
    nextCursor?: string,
  ): PaginationMeta {
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));
    const meta: PaginationMeta = {
      totalItems,
      currentPage: page,
      totalPages,
      itemsPerPage: limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };

    if (nextCursor !== undefined) {
      meta.nextCursor = nextCursor;
    }

    return meta;
  }

  /**
   * Constructs the complete standardized paginated JSON response payload.
   */
  public static createResponse<T>(
    data: T[],
    totalItems: number,
    params: { page: number; limit: number; nextCursor?: string },
    cacheInfo?: { isCached?: boolean; cacheLevel?: CacheLevel },
  ): PaginatedResponse<T> {
    const response: PaginatedResponse<T> = {
      data,
      pagination: PaginationUtil.buildMeta(
        totalItems,
        params.page,
        params.limit,
        params.nextCursor,
      ),
    };

    if (cacheInfo?.isCached !== undefined) {
      response.isCached = cacheInfo.isCached;
    }
    if (cacheInfo?.cacheLevel !== undefined) {
      response.cacheLevel = cacheInfo.cacheLevel;
    }

    return response;
  }
}

// Convenience export functions for clean functional usage.
// NOTE: wrapped in arrows (not direct method references) so `this` is never
// lost when destructured/imported — `createPaginatedResponse(...)` must work
// standalone, otherwise `this.buildMeta` throws
// "Cannot read properties of undefined (reading 'buildMeta')".
export const normalizePagination = (options?: PaginationOptions): NormalizedPagination =>
  PaginationUtil.normalize(options);
export const buildPaginationMeta = (
  totalItems: number,
  page: number,
  limit: number,
  nextCursor?: string,
): PaginationMeta => PaginationUtil.buildMeta(totalItems, page, limit, nextCursor);
export const createPaginatedResponse = <T>(
  data: T[],
  totalItems: number,
  params: { page: number; limit: number; nextCursor?: string },
  cacheInfo?: { isCached?: boolean; cacheLevel?: CacheLevel },
): PaginatedResponse<T> => PaginationUtil.createResponse(data, totalItems, params, cacheInfo);
