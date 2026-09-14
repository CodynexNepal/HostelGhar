// ──────────────────────────────────────────────────────────────────────────────
// FILE: cache.util.ts
// PURPOSE: Enterprise 3-Level Caching Layer:
//          - L1: Local In-Memory LRU Cache (Fastest: < 0.1ms, per-instance)
//          - L2: Distributed Redis Cache (Fast: ~1-3ms, shared across cluster)
//          - L3: Persistent Database Loader (PostgreSQL / TypeORM fallback)
// ──────────────────────────────────────────────────────────────────────────────

import { redisClient } from '../configs/redis.config';
import { LRUCache } from './lru-cache.util';

export type CacheLevel = 'L1' | 'L2' | 'L3';

export interface CacheOptions {
  l1TtlSeconds?: number; // L1 memory cache TTL (default: 60s)
  l2TtlSeconds?: number; // L2 Redis cache TTL (default: 300s)
  skipL1?: boolean; // Bypass L1 if needed
  skipL2?: boolean; // Bypass L2 if needed
}

export interface CacheWrapResult<T> {
  data: T;
  isCached: boolean;
  cacheLevel: CacheLevel;
}

export class MultiLevelCacheService {
  // Level 1: In-Memory LRU Cache (Max 2,000 items in RAM, default TTL 60s)
  private readonly l1Cache: LRUCache;

  // Default TTL configurations
  private readonly defaultL1TTL = 60; // 1 minute in memory
  private readonly defaultL2TTL = 300; // 5 minutes in Redis

  // Observability metrics
  private l1Hits = 0;
  private l2Hits = 0;
  private l3Hits = 0;
  private readonly inFlightLoads = new Map<string, Promise<unknown>>();

  constructor() {
    this.l1Cache = new LRUCache({
      maxSize: 2000,
      defaultTtlSeconds: this.defaultL1TTL,
    });
  }

  /**
   * Deterministically generates a standardized hierarchical cache key.
   */
  public generateKey(prefix: string, identifier: string | number | Record<string, any>): string {
    let serialized: string;
    if (typeof identifier === 'object' && identifier !== null) {
      // Sort keys for deterministic JSON serialization
      const sortedObj = Object.keys(identifier)
        .sort()
        .reduce((acc: Record<string, any>, key) => {
          acc[key] = identifier[key];
          return acc;
        }, {});
      serialized = JSON.stringify(sortedObj);
    } else {
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
  public async get<T>(
    key: string,
    options: CacheOptions = {},
  ): Promise<{ data: T; level: CacheLevel } | null> {
    // ── Check Level 1: Local In-Memory LRU Cache ──────────────────────────────
    if (!options.skipL1) {
      const l1Value = this.l1Cache.get(key);
      if (l1Value !== null && l1Value !== undefined) {
        this.l1Hits++;
        return { data: l1Value as T, level: 'L1' };
      }
    }

    // ── Check Level 2: Distributed Redis Cache ────────────────────────────────
    if (!options.skipL2) {
      try {
        const cached = await redisClient.get(key);
        if (cached) {
          const parsed = JSON.parse(cached) as T;
          this.l2Hits++;

          // Backfill Level 1 memory cache for ultra-fast subsequent lookups
          if (!options.skipL1) {
            const l1Ttl = options.l1TtlSeconds ?? this.defaultL1TTL;
            this.l1Cache.set(key, parsed, l1Ttl);
          }

          return { data: parsed, level: 'L2' };
        }
      } catch (err: any) {
        console.warn(`[MultiLevelCache] L2 (Redis) GET failed for "${key}":`, err.message);
      }
    }

    // Missed both L1 and L2
    return null;
  }

  /**
   * Sets data in both Level 1 (LRU Memory) and Level 2 (Redis) caches.
   */
  public async set<T>(key: string, data: T, options: number | CacheOptions = {}): Promise<void> {
    const opts: CacheOptions =
      typeof options === 'number'
        ? { l1TtlSeconds: Math.min(options, this.defaultL1TTL), l2TtlSeconds: options }
        : options;

    const l1Ttl = opts.l1TtlSeconds ?? this.defaultL1TTL;
    const l2Ttl = opts.l2TtlSeconds ?? this.defaultL2TTL;

    // 1. Write to Level 1 In-Memory LRU
    if (!opts.skipL1) {
      this.l1Cache.set(key, data, l1Ttl);
    }

    // 2. Write to Level 2 Distributed Redis
    if (!opts.skipL2) {
      try {
        await redisClient.set(key, JSON.stringify(data), 'EX', l2Ttl);
      } catch (err: any) {
        console.warn(`[MultiLevelCache] L2 (Redis) SET failed for "${key}":`, err.message);
      }
    }
  }

  /**
   * 3-Tier Cache Wrapper:
   * Level 1 (LRU Memory) -> Level 2 (Redis Distributed) -> Level 3 (Database Loader)
   */
  public async wrap<T>(
    key: string,
    loader: () => Promise<T>,
    options: number | CacheOptions = {},
  ): Promise<CacheWrapResult<T>> {
    const opts: CacheOptions =
      typeof options === 'number'
        ? { l1TtlSeconds: Math.min(options, this.defaultL1TTL), l2TtlSeconds: options }
        : options;

    // 1. Try L1 and L2 caches first
    const cached = await this.get<T>(key, opts);
    if (cached !== null) {
      return {
        data: cached.data,
        isCached: true,
        cacheLevel: cached.level,
      };
    }

    // Coalesce concurrent misses for the same key into one loader call.
    const existingLoad = this.inFlightLoads.get(key) as Promise<T> | undefined;
    const load = existingLoad || loader();
    if (!existingLoad) this.inFlightLoads.set(key, load);

    let freshData: T;
    try {
      this.l3Hits++;
      freshData = await load;
    } finally {
      if (!existingLoad) this.inFlightLoads.delete(key);
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
  public async invalidate(key: string): Promise<void> {
    this.l1Cache.delete(key);
    try {
      await redisClient.del(key);
    } catch (err: any) {
      console.warn(`[MultiLevelCache] Invalidation error for key "${key}":`, err.message);
    }
  }

  /**
   * Invalidates all keys matching a pattern across all cache tiers (L1 & L2).
   */
  public async invalidatePattern(pattern: string): Promise<void> {
    // 1. Invalidate L1 In-Memory LRU keys matching pattern
    const l1Removed = this.l1Cache.deletePattern(`cache:${pattern}*`);

    // 2. Invalidate L2 Distributed Redis keys matching pattern
    try {
      const keys: string[] = [];
      let cursor = '0';
      do {
        const result = await redisClient.scan(cursor, 'MATCH', `cache:${pattern}*`, 'COUNT', 100);
        cursor = result[0];
        keys.push(...result[1]);
      } while (cursor !== '0');
      if (keys.length > 0) {
        await redisClient.del(...keys);
        console.log(
          `[MultiLevelCache] Invalidated pattern "cache:${pattern}*" (L1: ${l1Removed}, L2: ${keys.length})`,
        );
      }
    } catch (err: any) {
      console.warn(`[MultiLevelCache] Pattern invalidation error for "${pattern}":`, err.message);
    }
  }

  /**
   * Telemetry and observability stats for all caching tiers.
   */
  public getStats() {
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
      overallCacheHitRate:
        totalRequests > 0
          ? (((this.l1Hits + this.l2Hits) / totalRequests) * 100).toFixed(2) + '%'
          : '0%',
    };
  }
}

// Export singleton multi-level cache service instance
export const cacheService = new MultiLevelCacheService();
export const multiLevelCache = cacheService;
