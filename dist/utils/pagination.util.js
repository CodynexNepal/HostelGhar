"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: pagination.util.ts
// PURPOSE: Modular, high-performance pagination calculation and response builder.
//          - Sanitizes & clamps query inputs (page, limit, order, sortBy)
//          - Calculates offset/skip & take for TypeORM and raw queries
//          - Standardizes paginated response with metadata and cache tier indicator
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPaginatedResponse = exports.buildPaginationMeta = exports.normalizePagination = exports.PaginationUtil = void 0;
class PaginationUtil {
    /**
     * Sanitizes, clamps, and normalizes pagination query parameters.
     */
    static normalize(options = {}) {
        const rawPage = typeof options.page === 'string' ? parseInt(options.page, 10) : options.page;
        const rawLimit = typeof options.limit === 'string' ? parseInt(options.limit, 10) : options.limit;
        const maxLimit = options.maxLimit || 100;
        const defaultLimit = options.defaultLimit || 20;
        const page = !rawPage || isNaN(rawPage) || rawPage < 1 ? 1 : Math.floor(rawPage);
        const limit = !rawLimit || isNaN(rawLimit) || rawLimit < 1
            ? defaultLimit
            : Math.min(Math.floor(rawLimit), maxLimit);
        const skip = (page - 1) * limit;
        const take = limit;
        const sortBy = options.sortBy || 'createdAt';
        const order = options.order?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        const result = {
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
    static buildMeta(totalItems, page, limit, nextCursor) {
        const totalPages = Math.max(1, Math.ceil(totalItems / limit));
        const meta = {
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
    static createResponse(data, totalItems, params, cacheInfo) {
        const response = {
            data,
            pagination: PaginationUtil.buildMeta(totalItems, params.page, params.limit, params.nextCursor),
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
exports.PaginationUtil = PaginationUtil;
// Convenience export functions for clean functional usage.
// NOTE: wrapped in arrows (not direct method references) so `this` is never
// lost when destructured/imported — `createPaginatedResponse(...)` must work
// standalone, otherwise `this.buildMeta` throws
// "Cannot read properties of undefined (reading 'buildMeta')".
const normalizePagination = (options) => PaginationUtil.normalize(options);
exports.normalizePagination = normalizePagination;
const buildPaginationMeta = (totalItems, page, limit, nextCursor) => PaginationUtil.buildMeta(totalItems, page, limit, nextCursor);
exports.buildPaginationMeta = buildPaginationMeta;
const createPaginatedResponse = (data, totalItems, params, cacheInfo) => PaginationUtil.createResponse(data, totalItems, params, cacheInfo);
exports.createPaginatedResponse = createPaginatedResponse;
