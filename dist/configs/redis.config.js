"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: redis.config.ts
// PURPOSE: Centralized Redis manager. Reuses one connection for all BullMQ
//          Queue producers and tracks every client so shutdown can QUIT them
//          (prevents "ERR max number of clients reached" crash-loops).
// ──────────────────────────────────────────────────────────────────────────────
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeAllRedisConnections = exports.getSharedQueueConnection = exports.redisClient = exports.createRedisClient = exports.redisOptions = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const envConfig_1 = require("./envConfig");
const redisUrl = envConfig_1.dotEnvConfig.REDIS_URL || 'redis://127.0.0.1:6379';
const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
const isPassenger = typeof global.PhusionPassenger !== 'undefined' || process.env.PASSENGER_MODE === 'true';
const isRedisDisabled = !envConfig_1.dotEnvConfig.ENABLE_REDIS ||
    envConfig_1.dotEnvConfig.USE_DIRECT_SMTP ||
    (isPassenger && process.env.ENABLE_WORKERS !== 'true');
exports.redisOptions = {
    maxRetriesPerRequest: isTest ? 1 : null,
    enableReadyCheck: false,
    enableOfflineQueue: false, // Prevents queuing commands indefinitely in memory when Redis is offline
    lazyConnect: true,
    keepAlive: 10000,
    connectTimeout: isTest ? 1000 : 3500,
    retryStrategy: (times) => {
        if (isTest || isRedisDisabled) {
            return null;
        }
        if (times > 5) {
            console.warn('[Redis] Connection attempts exhausted. Running in standalone direct mode.');
            return null;
        }
        const delay = Math.min(times * 200 + Math.floor(Math.random() * 300), 20000);
        if (times % 3 === 1) {
            console.warn(`[Redis] Connection lost. Reconnect #${times} in ${delay}ms...`);
        }
        return delay;
    },
    reconnectOnError: (err) => {
        if (isTest) {
            return false;
        }
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
const clientRegistry = new Set();
function trackClient(client, clientName) {
    clientRegistry.add(client);
    client.on('connect', () => {
        console.log(`[Redis:${clientName}] Connected successfully`);
    });
    client.on('ready', () => {
        console.log(`[Redis:${clientName}] Ready`);
        // Attempt to set eviction policy to noeviction for BullMQ stability
        client.config('SET', 'maxmemory-policy', 'noeviction').catch(() => { });
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
const createRedisClient = (clientName = 'default') => {
    const client = new ioredis_1.default(redisUrl, {
        ...exports.redisOptions,
        connectionName: `hostelghar:${clientName}`,
    });
    trackClient(client, clientName);
    return client;
};
exports.createRedisClient = createRedisClient;
// Default shared client instance
exports.redisClient = (0, exports.createRedisClient)('main');
let sharedQueueConnection = null;
const getSharedQueueConnection = () => {
    if (!sharedQueueConnection || sharedQueueConnection.status === 'end') {
        sharedQueueConnection = (0, exports.createRedisClient)('queues-shared');
    }
    return sharedQueueConnection;
};
exports.getSharedQueueConnection = getSharedQueueConnection;
const closeAllRedisConnections = async () => {
    const clients = [...clientRegistry];
    if (clients.length === 0)
        return;
    console.log(`[Redis] Closing ${clients.length} connection(s)...`);
    await Promise.allSettled(clients.map(async (client) => {
        try {
            if (client.status === 'ready' || client.status === 'connect') {
                await client.quit().catch(() => client.disconnect());
            }
            else {
                client.disconnect();
            }
        }
        catch {
            client.disconnect();
        }
    }));
    clientRegistry.clear();
    sharedQueueConnection = null;
};
exports.closeAllRedisConnections = closeAllRedisConnections;
