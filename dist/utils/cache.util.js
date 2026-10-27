"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: cache.util.ts
// PURPOSE: Enterprise 3-Level Caching Layer:
//          - L1: Local In-Memory LRU Cache (Fastest: < 0.1ms, per-instance)
//          - L2: Distributed Redis Cache (Fast: ~1-3ms, shared across cluster)
//          - L3: Persistent Database Loader (PostgreSQL / TypeORM fallback)
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.multiLevelCache = exports.cacheService = exports.MultiLevelCacheService = void 0;
const redis_config_1 = require("../configs/redis.config");
const lru_cache_util_1 = require("./lru-cache.util");
const brotli_util_1 = require("./brotli.util");
class MultiLevelCacheService {
    constructor() {
        // Default TTL configurations
        this.defaultL1TTL = 60; // 1 minute in memory
        this.defaultL2TTL = 300; // 5 minutes in Redis
        // Observability metrics
        this.l1Hits = 0;
        this.l2Hits = 0;
        this.l3Hits = 0;
        this.inFlightLoads = new Map();
        this.l1Cache = new lru_cache_util_1.LRUCache({
            maxSize: 2000,
            defaultTtlSeconds: this.defaultL1TTL,
        });
    }
    /**
     * Deterministically generates a standardized hierarchical cache key.
     */
    generateKey(prefix, identifier) {
        let serialized;
        if (typeof identifier === 'object' && identifier !== null) {
            // Sort keys for deterministic JSON serialization
            const sortedObj = Object.keys(identifier)
                .sort()
                .reduce((acc, key) => {
                acc[key] = identifier[key];
                return acc;
            }, {});
            serialized = JSON.stringify(sortedObj);
        }
        else {
            serialized = String(identifier);
        }
        return `cache:${prefix}:${serialized}`;
    }
    /**
     * Retrieves an item through the 3-tier hierarchy:
     * 1. Check L1 Memory LRU
     * 2. Check L2 Redis (if found, backfill L1 Memory)
     * 3. Return null (L3 Miss)
     */
    async get(key, options = {}) {
        // ── Check Level 1: Local In-Memory LRU Cache ──────────────────────────────
        if (!options.skipL1) {
            const l1Value = this.l1Cache.get(key);
            if (l1Value !== null && l1Value !== undefined) {
                const validation = options.validateCached ? await options.validateCached(l1Value) : true;
                if (validation === false) {
                    await this.invalidate(key);
                    return null;
                }
                this.l1Hits++;
                return { data: l1Value, level: 'L1' };
            }
        }
        // ── Check Level 2: Distributed Redis Cache ────────────────────────────────
        if (!options.skipL2 && redis_config_1.redisClient.status === 'ready') {
            try {
                const cached = await redis_config_1.redisClient.get(key);
                if (cached) {
                    // Brotli (`br1:`) or legacy plain JSON — decodeDataPayload handles both.
                    const parsed = (0, brotli_util_1.decodeDataPayload)(cached);
                    const validation = options.validateCached ? await options.validateCached(parsed) : true;
                    if (validation === false) {
                        await this.invalidate(key);
                        return null;
                    }
                    this.l2Hits++;
                    // Backfill Level 1 memory cache for ultra-fast subsequent lookups
                    if (!options.skipL1) {
                        const l1Ttl = options.l1TtlSeconds ?? this.defaultL1TTL;
                        this.l1Cache.set(key, parsed, l1Ttl);
                    }
                    return { data: parsed, level: 'L2' };
                }
            }
            catch (err) {
                console.warn(`[MultiLevelCache] L2 (Redis) GET failed for "${key}":`, err.message);
            }
        }
        // Missed both L1 and L2
        return null;
    }
    /**
     * Sets data in both Level 1 (LRU Memory) and Level 2 (Redis) caches.
     */
    async set(key, data, options = {}) {
        const opts = typeof options === 'number'
            ? { l1TtlSeconds: Math.min(options, this.defaultL1TTL), l2TtlSeconds: options }
            : options;
        const l1Ttl = opts.l1TtlSeconds ?? this.defaultL1TTL;
        const l2Ttl = opts.l2TtlSeconds ?? this.defaultL2TTL;
        // 1. Write to Level 1 In-Memory LRU
        if (!opts.skipL1) {
            this.l1Cache.set(key, data, l1Ttl);
        }
        // 2. Write to Level 2 Distributed Redis (Brotli-compressed via `brotli` npm)
        if (!opts.skipL2 && redis_config_1.redisClient.status === 'ready') {
            try {
                // L1 keeps the live object (no decompress cost on the hot path); L2
                // stores `br1:` when it saves bytes — less Redis memory + bandwidth.
                const stored = opts.compressL2 === false ? JSON.stringify(data) : (0, brotli_util_1.encodeDataPayload)(data);
                await redis_config_1.redisClient.set(key, stored, 'EX', l2Ttl);
            }
            catch (err) {
                console.warn(`[MultiLevelCache] L2 (Redis) SET failed for "${key}":`, err.message);
            }
        }
    }
    /**
     * 3-Tier Cache Wrapper:
     * Level 1 (LRU Memory) -> Level 2 (Redis Distributed) -> Level 3 (Database Loader)
     */
    async wrap(key, loader, options = {}) {
        const opts = typeof options === 'number'
            ? { l1TtlSeconds: Math.min(options, this.defaultL1TTL), l2TtlSeconds: options }
            : options;
        // 1. Try L1 and L2 caches first
        const cached = await this.get(key, opts);
        if (cached !== null) {
            return {
                data: cached.data,
                isCached: true,
                cacheLevel: cached.level,
            };
        }
        // Coalesce concurrent misses for the same key into one loader call.
        const existingLoad = this.inFlightLoads.get(key);
        const load = existingLoad || loader();
        if (!existingLoad)
            this.inFlightLoads.set(key, load);
        let freshData;
        try {
            this.l3Hits++;
            freshData = await load;
        }
        finally {
            if (!existingLoad)
                this.inFlightLoads.delete(key);
        }
        // 3. Populate L1 and L2 for future requests
        await this.set(key, freshData, opts);
        return {
            data: freshData,
            isCached: false,
            cacheLevel: 'L3',
        };
    }
    /**
     * Invalidates a specific key from all cache tiers (L1 & L2).
     */
    async invalidate(key) {
        this.l1Cache.delete(key);
        if (redis_config_1.redisClient.status === 'ready') {
            try {
                await redis_config_1.redisClient.del(key);
            }
            catch (err) {
                console.warn(`[MultiLevelCache] Invalidation error for key "${key}":`, err.message);
            }
        }
    }
    /**
     * Invalidates all keys matching a pattern across all cache tiers (L1 & L2).
     */
    async invalidatePattern(pattern) {
        // 1. Invalidate L1 In-Memory LRU keys matching pattern
        const l1Removed = this.l1Cache.deletePattern(`cache:${pattern}*`);
        // 2. Invalidate L2 Distributed Redis keys matching pattern
        if (redis_config_1.redisClient.status === 'ready') {
            try {
                const keys = [];
                let cursor = '0';
                do {
                    const result = await redis_config_1.redisClient.scan(cursor, 'MATCH', `cache:${pattern}*`, 'COUNT', 100);
                    cursor = result[0];
                    keys.push(...result[1]);
                } while (cursor !== '0');
                if (keys.length > 0) {
                    await redis_config_1.redisClient.del(...keys);
                    console.log(`[MultiLevelCache] Invalidated pattern "cache:${pattern}*" (L1: ${l1Removed}, L2: ${keys.length})`);
                }
            }
            catch (err) {
                console.warn(`[MultiLevelCache] Pattern invalidation error for "${pattern}":`, err.message);
            }
        }
    }
    /**
     * Deletes all keys whose full key CONTAINS the substring (L1 + L2).
     * Needed for logout: user ids are embedded inside serialized JSON keys
     * (e.g. cache:owner:residents:{"ownerId":"<uuid>",...}) so a prefix match
     * on the user id alone would miss them. Bounded SCAN + chunked DEL.
     */
    async invalidateContaining(substring) {
        if (!substring)
            return 0;
        let l1Removed = 0;
        try {
            const l1Keys = this.l1Cache.keysContaining(substring);
            for (const k of l1Keys)
                this.l1Cache.delete(k);
            l1Removed = l1Keys.length;
        }
        catch (err) {
            console.warn(`[MultiLevelCache] L1 substring invalidate failed:`, err.message);
        }
        let l2Removed = 0;
        if (redis_config_1.redisClient.status === 'ready') {
            try {
                const keys = [];
                let cursor = '0';
                do {
                    const result = await redis_config_1.redisClient.scan(cursor, 'MATCH', 'cache:*', 'COUNT', 200);
                    cursor = result[0];
                    for (const k of result[1])
                        if (k.includes(substring))
                            keys.push(k);
                    if (keys.length >= 2000)
                        break;
                } while (cursor !== '0');
                for (let i = 0; i < keys.length; i += 200) {
                    await redis_config_1.redisClient.del(...keys.slice(i, i + 200));
                }
                l2Removed = keys.length;
            }
            catch (err) {
                console.warn(`[MultiLevelCache] L2 substring invalidate failed:`, err.message);
            }
        }
        return l1Removed + l2Removed;
    }
    /**
     * Telemetry and observability stats for all caching tiers.
     */
    getStats() {
        const totalRequests = this.l1Hits + this.l2Hits + this.l3Hits;
        return {
            l1: {
                ...this.l1Cache.getStats(),
                hits: this.l1Hits,
            },
            l2: {
                hits: this.l2Hits,
            },
            l3: {
                databaseQueries: this.l3Hits,
            },
            totalRequests,
            overallCacheHitRate: totalRequests > 0
                ? (((this.l1Hits + this.l2Hits) / totalRequests) * 100).toFixed(2) + '%'
                : '0%',
        };
    }
}
exports.MultiLevelCacheService = MultiLevelCacheService;
// Export singleton multi-level cache service instance
exports.cacheService = new MultiLevelCacheService();
exports.multiLevelCache = exports.cacheService;
