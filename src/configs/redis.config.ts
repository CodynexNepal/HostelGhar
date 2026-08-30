// ──────────────────────────────────────────────────────────────────────────────
// FILE: redis.config.ts
// PURPOSE: Centralized Redis connection manager providing dedicated connections
//          for BullMQ queues, workers, Redis Pub/Sub, and caching.
// ──────────────────────────────────────────────────────────────────────────────

import Redis, { RedisOptions } from 'ioredis';
import { dotEnvConfig } from './envConfig';

const redisUrl = dotEnvConfig.REDIS_URL || 'redis://127.0.0.1:6379';

export const redisOptions: RedisOptions = {
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
  retryStrategy: (times: number) => {
    // Exponential backoff for Redis reconnection with jitter and max delay of 20s
    const delay = Math.min(times * 100 + Math.floor(Math.random() * 200), 20000);
    console.warn(`[Redis] Connection lost. Attempting reconnect #${times} in ${delay}ms...`);
    return delay;
  },
  reconnectOnError: (err) => {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      return true;
    }
    return false;
  },
};

/**
 * Factory function to create dedicated Redis instances.
 * BullMQ requires separate client instances for producers and consumers (subscribers).
 */
export const createRedisClient = (clientName: string = 'default'): Redis => {
  const client = new Redis(redisUrl, redisOptions);

  client.on('connect', () => {
    console.log(`[Redis:${clientName}] Connected successfully`);
  });

  client.on('error', (err) => {
    console.error(`[Redis:${clientName}] Connection Error:`, err.message);
  });

  client.on('close', () => {
    console.warn(`[Redis:${clientName}] Connection closed`);
  });

  return client;
};

// Default shared client instance
export const redisClient = createRedisClient('main');
