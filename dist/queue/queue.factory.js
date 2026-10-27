"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: queue.factory.ts
// PURPOSE: Centralized BullMQ Queue factory configured with default exponential
//          backoff, retry attempts, timeout limits, and Dead-Letter cleanup rules.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.residentImportQueue = exports.systemEventQueue = exports.auditLogQueue = exports.notificationQueue = exports.emailQueue = exports.defaultJobOptions = void 0;
exports.getQueue = getQueue;
const bullmq_1 = require("bullmq");
const redis_config_1 = require("../configs/redis.config");
const queue_constants_1 = require("../constant/queue.constants");
/**
 * Standard Job Options with Exponential Backoff and Retry Configuration
 */
exports.defaultJobOptions = {
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
const queueRegistry = new Map();
function getQueue(queueName, customOptions) {
    if (queueRegistry.has(queueName)) {
        return queueRegistry.get(queueName);
    }
    const connection = (0, redis_config_1.getSharedQueueConnection)();
    const queue = new bullmq_1.Queue(queueName, {
        connection,
        defaultJobOptions: exports.defaultJobOptions,
        ...customOptions,
    });
    queue.on('error', (err) => {
        console.error(`[Queue:${queueName}] Queue error:`, err.message);
    });
    queueRegistry.set(queueName, queue);
    return queue;
}
// Pre-instantiated core queues
exports.emailQueue = getQueue(queue_constants_1.QueueName.EMAIL);
exports.notificationQueue = getQueue(queue_constants_1.QueueName.NOTIFICATION);
exports.auditLogQueue = getQueue(queue_constants_1.QueueName.AUDIT_LOG);
exports.systemEventQueue = getQueue(queue_constants_1.QueueName.SYSTEM_EVENT);
exports.residentImportQueue = getQueue(queue_constants_1.QueueName.RESIDENT_IMPORT);
