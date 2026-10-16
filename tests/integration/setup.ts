// ──────────────────────────────────────────────────────────────────────────────
// FILE: tests/integration/setup.ts
// PURPOSE: Hermetic module stubs shared by integration suites. Installed
//          BEFORE createApp() is imported so the composition root never
//          opens a DB/Redis/socket connection at module scope.
// ──────────────────────────────────────────────────────────────────────────────
import { vi } from 'vitest';

vi.mock('../../src/database/database-source', () => ({
  AppDataSource: {
    // Initialized so /health/ready deterministically reports postgres: up
    // in hermetic runs (query stub answers SELECT 1 below).
    isInitialized: true,
    query: async () => [{ '?column?': 1 }],
    // Repositories call getRepository() in their constructors at import
    // time (e.g. AuthFactory → UserRepository). Return a no-op stub so
    // importing the route tree never needs a live TypeORM connection.
    getRepository: () => ({
      findOne: async () => null,
      find: async () => [],
      save: async (entity: unknown) => entity,
    }),
  },
}));

vi.mock('../../src/configs/redis.config', () => ({
  redisClient: {
    status: 'ready',
    ping: async () => 'PONG',
    get: async () => null,
    set: async () => 'OK',
    del: async () => 0,
  },
  createRedisClient: () => ({ status: 'end', on: () => undefined }),
  getSharedQueueConnection: () => ({ status: 'end', on: () => undefined }),
  closeAllRedisConnections: async () => undefined,
}));

// BullMQ Queue objects connect at import time (queue.factory pre-builds
// five queues). Stub them so integration runs never dial Redis — the
// route tree only needs .add()/.on() to exist.
const queueStub = { on: () => undefined, add: async () => ({ id: 'stub' }) };
vi.mock('../../src/queue/queue.factory', () => ({
  getQueue: () => queueStub,
  emailQueue: queueStub,
  notificationQueue: queueStub,
  auditLogQueue: queueStub,
  systemEventQueue: queueStub,
  residentImportQueue: queueStub,
  defaultJobOptions: {},
}));

// socketContextMiddleware warns per request when Socket.io is uninitialised.
// A quiet stub keeps integration logs clean without changing behaviour.
vi.mock('../../src/socket/socket.server', () => ({
  socketServer: {
    getIO: () => ({}),
    toUser: () => undefined,
    toHostel: () => undefined,
    toRole: () => undefined,
    toRoom: () => undefined,
    broadcast: () => undefined,
    init: () => ({}),
    close: async () => undefined,
  },
}));
