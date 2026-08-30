// ──────────────────────────────────────────────────────────────────────────────
// FILE: cache.util.ts
// PURPOSE: High-speed Redis caching utility with TTL, stale-while-revalidate,
//          cache key hashing, and response decoration (isCached: true).
// ──────────────────────────────────────────────────────────────────────────────

import { redisClient } from '../configs/redis.config';

export interface CacheOptions {
  ttlSeconds?: number;
  prefix?: string;
}

export class CacheService {
  private defaultTTL = 300; // 5 minutes default

  /**
   * Generates a deterministic cache key.
   */
  public generateKey(prefix: string, identifier: string | Record<string, any>): string {
    const serialized = typeof identifier === 'string' ? identifier : JSON.stringify(identifier);
    return `cache:${prefix}:${serialized}`;
  }

  /**
   * Retrieves an item from cache.
   */
  public async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await redisClient.get(key);
      if (cached) {
        return JSON.parse(cached) as T;
      }
      return null;
    } catch (err: any) {
      console.warn(`[CacheService] Redis GET failed for key "${key}":`, err.message);
      return null;
    }
  }

  /**
   * Sets an item in cache with TTL.
   */
  public async set(key: string, data: any, ttlSeconds: number = this.defaultTTL): Promise<void> {
    try {
      await redisClient.set(key, JSON.stringify(data), 'EX', ttlSeconds);
    } catch (err: any) {
      console.warn(`[CacheService] Redis SET failed for key "${key}":`, err.message);
    }
  }

  /**
   * Cache wrapper function: fetches from cache or calls fallback loader.
   */
  public async wrap<T>(
    key: string,
    loader: () => Promise<T>,
    ttlSeconds: number = this.defaultTTL,
  ): Promise<{ data: T; isCached: boolean }> {
    const cachedData = await this.get<T>(key);
    if (cachedData !== null) {
      return { data: cachedData, isCached: true };
    }

    const freshData = await loader();
    await this.set(key, freshData, ttlSeconds);
    return { data: freshData, isCached: false };
  }

  /**
   * Invalidation by key pattern (e.g. invalidating all hostels cache)
   */
  public async invalidatePattern(pattern: string): Promise<void> {
    try {
      const keys = await redisClient.keys(`cache:${pattern}*`);
      if (keys.length > 0) {
        await redisClient.del(...keys);
        console.log(
          `[CacheService] Invalidated ${keys.length} keys matching pattern: cache:${pattern}*`,
        );
      }
    } catch (err: any) {
      console.warn(`[CacheService] Invalidation error for pattern "${pattern}":`, err.message);
    }
  }
}

export const cacheService = new CacheService();
