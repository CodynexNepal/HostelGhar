// ──────────────────────────────────────────────────────────────────────────────
// FILE: redis.config.ts
// PURPOSE: Centralized Redis manager. Reuses one connection for all BullMQ
//          Queue producers and tracks every client so shutdown can QUIT them
//          (prevents "ERR max number of clients reached" crash-loops).
// ──────────────────────────────────────────────────────────────────────────────

import Redis, { RedisOptions } from 'ioredis';
import { dotEnvConfig } from './envConfig';

const redisUrl = dotEnvConfig.REDIS_URL || 'redis://127.0.0.1:6379';

export const redisOptions: RedisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  enableOfflineQueue: true,
  keepAlive: 10000,
  connectTimeout: 10000,
  retryStrategy: (times: number) => {
    if (times > 20) {
      console.error('[Redis] Giving up reconnection after 20 attempts.');
      return null;
    }
    const delay = Math.min(times * 200 + Math.floor(Math.random() * 300), 20000);
    if (times % 5 === 1) {
      console.warn(`[Redis] Connection lost. Reconnect #${times} in ${delay}ms...`);
    }
    return delay;
  },
  reconnectOnError: (err) => {
    if (err.message.includes('max number of clients')) {
      console.error('[Redis] Server full (max clients). Not retrying aggressively.');
      return false;
    }
    if (err.message.includes('READONLY')) {
      return true;
    }
    return false;
  },
};

const clientRegistry = new Set<Redis>();

function trackClient(client: Redis, clientName: string): void {
  clientRegistry.add(client);
  client.on('connect', () => {
    console.log(`[Redis:${clientName}] Connected successfully`);
  });
  client.on('ready', () => {
    console.log(`[Redis:${clientName}] Ready`);
  });
  client.on('error', (err) => {
    console.error(`[Redis:${clientName}] Connection Error:`, err.message);
  });
  client.on('close', () => {
    console.warn(`[Redis:${clientName}] Connection closed`);
  });
  client.on('end', () => {
    clientRegistry.delete(client);
  });
}

/**
 * Factory function to create dedicated Redis instances.
 * BullMQ requires separate client instances for producers and consumers (subscribers).
 */
export const createRedisClient = (clientName: string = 'default'): Redis => {
  const client = new Redis(redisUrl, {
    ...redisOptions,
    connectionName: `hostelghar:${clientName}`,
  });
  trackClient(client, clientName);
  return client;
};

// Default shared client instance
export const redisClient = createRedisClient('main');

let sharedQueueConnection: Redis | null = null;

export const getSharedQueueConnection = (): Redis => {
  if (!sharedQueueConnection || sharedQueueConnection.status === 'end') {
    sharedQueueConnection = createRedisClient('queues-shared');
  }
  return sharedQueueConnection;
};

export const closeAllRedisConnections = async (): Promise<void> => {
  const clients = [...clientRegistry];
  if (clients.length === 0) return;
  console.log(`[Redis] Closing ${clients.length} connection(s)...`);
  await Promise.allSettled(
    clients.map(async (client) => {
      try {
        if (client.status === 'ready' || client.status === 'connect') {
          await client.quit().catch(() => client.disconnect());
        } else {
          client.disconnect();
        }
      } catch {
        client.disconnect();
      }
    }),
  );
  clientRegistry.clear();
  sharedQueueConnection = null;
};
