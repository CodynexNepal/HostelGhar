// ──────────────────────────────────────────────────────────────────────────────
// FILE: tests/setup.ts
// PURPOSE: Global Vitest setup ensuring tests are hermetic and never hang
//          attempting to connect to external Redis or BullMQ services.
// ──────────────────────────────────────────────────────────────────────────────
import { vi } from 'vitest';

// Stub Redis client so test suites never dial a live Redis instance
vi.mock('../src/configs/redis.config', () => ({
  redisClient: {
    status: 'ready',
    ping: async () => 'PONG',
    get: async () => null,
    set: async () => 'OK',
    del: async () => 0,
    scan: async () => ['0', []],
    on: () => undefined,
  },
  createRedisClient: () => ({ status: 'end', on: () => undefined }),
  getSharedQueueConnection: () => ({ status: 'end', on: () => undefined }),
  closeAllRedisConnections: async () => undefined,
  redisOptions: {},
}));

// Stub BullMQ queues so route imports never spin up background workers
const queueStub = { on: () => undefined, add: async () => ({ id: 'stub' }) };
vi.mock('../src/queue/queue.factory', () => ({
  getQueue: () => queueStub,
  emailQueue: queueStub,
  notificationQueue: queueStub,
  auditLogQueue: queueStub,
  systemEventQueue: queueStub,
  residentImportQueue: queueStub,
  defaultJobOptions: {},
}));
