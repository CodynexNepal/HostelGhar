// ──────────────────────────────────────────────────────────────────────────────
// FILE: tests/setup.ts
// PURPOSE: Global Vitest setup ensuring tests are hermetic and never hang
//          attempting to connect to external Redis or BullMQ services.
// ──────────────────────────────────────────────────────────────────────────────
import { vi } from 'vitest';

process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || 'https://dashboard.hostelghar.com';
process.env.SMTP_HOST = process.env.SMTP_HOST || 'mail.hostelghar.test';
process.env.SMTP_PORT = process.env.SMTP_PORT || '587';
process.env.SMTP_USER = process.env.SMTP_USER || 'notifications@hostelghar.test';
process.env.SMTP_PASS = process.env.SMTP_PASS || 'test-smtp-password';

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
  createRedisClient: () => ({
    status: 'end',
    on: () => undefined,
    disconnect: () => undefined,
    quit: async () => undefined,
  }),
  getSharedQueueConnection: () => ({ status: 'end', on: () => undefined }),
  closeAllRedisConnections: async () => undefined,
  redisOptions: {},
}));

// Stub BullMQ queues so route imports never spin up background workers
const queueStub = {
  on: () => undefined,
  add: async () => ({ id: 'stub' }),
  addBulk: async (jobs: any[]) => jobs.map((_, i) => ({ id: `stub-${i}` })),
  getJob: async (id: string) => ({
    id,
    getState: async () => 'completed',
    progress: 100,
    returnvalue: { generatedCount: 1, errors: 0 },
    failedReason: null,
  }),
  getWorkers: async () => [{ id: 'worker-stub' }],
};
vi.mock('../src/queue/queue.factory', () => ({
  getQueue: () => queueStub,
  emailQueue: queueStub,
  notificationQueue: queueStub,
  auditLogQueue: queueStub,
  systemEventQueue: queueStub,
  residentImportQueue: queueStub,
  defaultJobOptions: {},
}));
