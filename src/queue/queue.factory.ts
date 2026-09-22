// ──────────────────────────────────────────────────────────────────────────────
// FILE: queue.factory.ts
// PURPOSE: Centralized BullMQ Queue factory configured with default exponential
//          backoff, retry attempts, timeout limits, and Dead-Letter cleanup rules.
// ──────────────────────────────────────────────────────────────────────────────

import { Queue, QueueOptions, JobsOptions } from 'bullmq';
import { createRedisClient } from '../configs/redis.config';
import { QueueName } from '../constant/queue.constants';

/**
 * Standard Job Options with Exponential Backoff and Retry Configuration
 */
export const defaultJobOptions: JobsOptions = {
  attempts: 5, // Retry up to 5 times
  backoff: {
    type: 'exponential',
    delay: 2000, // 2s -> 4s -> 8s -> 16s -> 32s
  },
  removeOnComplete: {
    age: 3600 * 24, // Keep completed jobs for 24 hours
    count: 1000, // Keep max 1000 completed jobs
  },
  removeOnFail: {
    age: 3600 * 24 * 7, // Keep failed jobs for 7 days for audit/DLQ
    count: 5000,
  },
};

const queueRegistry = new Map<string, Queue>();

export function getQueue(queueName: QueueName, customOptions?: Partial<QueueOptions>): Queue {
  if (queueRegistry.has(queueName)) {
    return queueRegistry.get(queueName)!;
  }

  const connection = createRedisClient(`queue:${queueName}`);

  const queue = new Queue(queueName, {
    connection,
    defaultJobOptions,
    ...customOptions,
  });

  queue.on('error', (err) => {
    console.error(`[Queue:${queueName}] Queue error:`, err.message);
  });

  queueRegistry.set(queueName, queue);
  return queue;
}

// Pre-instantiated core queues
export const emailQueue = getQueue(QueueName.EMAIL);
export const notificationQueue = getQueue(QueueName.NOTIFICATION);
export const auditLogQueue = getQueue(QueueName.AUDIT_LOG);
export const systemEventQueue = getQueue(QueueName.SYSTEM_EVENT);
export const residentImportQueue = getQueue(QueueName.RESIDENT_IMPORT);
