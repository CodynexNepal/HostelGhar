"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: event-dispatcher.ts
// PURPOSE: Unified Application Event Dispatcher bridging internal events,
//          BullMQ job queues, and real-time Socket.io broadcasts.
// ──────────────────────────────────────────────────────────────────────────────
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventDispatcher = void 0;
const events_1 = require("events");
const crypto_1 = __importDefault(require("crypto"));
const queue_factory_1 = require("../queue/queue.factory");
const redis_config_1 = require("../configs/redis.config");
const queue_constants_1 = require("../constant/queue.constants");
const socket_server_1 = require("../socket/socket.server");
const logger_1 = require("../observability/logger");
const envConfig_1 = require("../configs/envConfig");
let cachedWorkerCheck = null;
const WORKER_CHECK_TTL_MS = 30000;
class AppEventDispatcher extends events_1.EventEmitter {
    constructor() {
        super();
        this.setupInternalHandlers();
    }
    /**
     * Dispatches a domain event asynchronously across BullMQ queues and real-time sockets
     */
    async dispatch(event) {
        const timestampedEvent = {
            ...event,
            timestamp: event.timestamp || new Date(),
        };
        // 1. Emit locally via Node EventEmitter
        this.emit(event.type, timestampedEvent);
        // 2. Broadcast via Socket.io to target recipients
        this.broadcastRealtime(timestampedEvent);
        // 3. Queue asynchronous audit logging
        if (envConfig_1.dotEnvConfig.ENABLE_REDIS && redis_config_1.redisClient.status === 'ready') {
            try {
                await Promise.race([
                    queue_factory_1.auditLogQueue.add(queue_constants_1.JobType.LOG_USER_ACTIVITY, {
                        userId: event.userId,
                        action: event.type,
                        resource: event.hostelId ? `hostel:${event.hostelId}` : 'system',
                        metadata: event.metadata,
                        timestamp: timestampedEvent.timestamp.toISOString(),
                    }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Audit log queue timed out')), 2000).unref()),
                ]);
            }
            catch (err) {
                logger_1.logger.warn('Failed to enqueue audit log activity', { error: err?.message || String(err) });
            }
        }
    }
    /**
     * Helper to dispatch email job to BullMQ queue with bounded timeout,
     * with automatic reliable direct SMTP fallback when Redis queue is unreachable
     * or when no active workers are available to process the queue.
     */
    async queueEmail(jobType, data, options) {
        const correlationId = data.context?.correlationId || crypto_1.default.randomUUID();
        const recipientDomain = data.to.split('@')[1] || 'unknown';
        const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
        const isPassenger = typeof global.PhusionPassenger !== 'undefined' ||
            typeof process.env.PASSENGER_APP_ENV !== 'undefined' ||
            typeof process.env.PASSENGER_SPAWN_METHOD !== 'undefined' ||
            process.env.PASSENGER_MODE === 'true';
        const isDirectSmtpMode = !isTest &&
            (envConfig_1.dotEnvConfig.USE_DIRECT_SMTP ||
                !envConfig_1.dotEnvConfig.ENABLE_REDIS ||
                (isPassenger && process.env.ENABLE_WORKERS !== 'true') ||
                redis_config_1.redisClient.status !== 'ready');
        // 1. Direct SMTP Mode: on cPanel, shared hosting without Redis, or disconnected Redis
        if ((isDirectSmtpMode || redis_config_1.redisClient.status !== 'ready') &&
            options?.fallbackToDirectSmtp !== false) {
            logger_1.logger.info('Dispatching email via direct SMTP (cPanel/direct-SMTP mode without BullMQ Redis)', {
                correlationId,
                queue: queue_constants_1.QueueName.EMAIL,
                jobType,
                recipientDomain,
            });
            const { emailSenderService } = await Promise.resolve().then(() => __importStar(require('../services/email/email-sender.service')));
            await emailSenderService.send({
                to: data.to,
                subject: data.subject,
                body: data.body || '',
                ...(data.html ? { html: data.html } : {}),
            }, { correlationId });
            return { id: 'direct-smtp-fallback', name: jobType, data };
        }
        // 2. Check if active BullMQ workers are currently subscribed to the email queue.
        // If no workers exist (e.g. on cPanel Passenger where background workers are not spawned),
        // enqueuing to Redis would strand the job indefinitely. Dispatch via direct SMTP immediately.
        let hasActiveWorkers = false;
        if (!isTest &&
            cachedWorkerCheck &&
            Date.now() - cachedWorkerCheck.timestamp < WORKER_CHECK_TTL_MS) {
            hasActiveWorkers = cachedWorkerCheck.hasWorkers;
        }
        else if (typeof queue_factory_1.emailQueue.getWorkers === 'function') {
            try {
                const workers = await Promise.race([
                    queue_factory_1.emailQueue.getWorkers(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Worker check timed out')), 2500).unref()),
                ]);
                hasActiveWorkers = Array.isArray(workers) && workers.length > 0;
                if (!isTest) {
                    cachedWorkerCheck = { hasWorkers: hasActiveWorkers, timestamp: Date.now() };
                }
            }
            catch {
                hasActiveWorkers = false;
            }
        }
        else {
            hasActiveWorkers = true;
        }
        if (!hasActiveWorkers && options?.fallbackToDirectSmtp !== false) {
            logger_1.logger.warn('No active BullMQ workers listening on email queue; dispatching via direct SMTP fallback', {
                correlationId,
                queue: queue_constants_1.QueueName.EMAIL,
                jobType,
                recipientDomain,
            });
            const { emailSenderService } = await Promise.resolve().then(() => __importStar(require('../services/email/email-sender.service')));
            await emailSenderService.send({
                to: data.to,
                subject: data.subject,
                body: data.body || '',
                ...(data.html ? { html: data.html } : {}),
            }, { correlationId });
            return { id: 'direct-smtp-fallback', name: jobType, data };
        }
        // 3. Dispatch to BullMQ queue with bounded confirmation timeout
        const timeoutMs = options?.timeoutMs ?? 2500;
        try {
            const job = await Promise.race([
                queue_factory_1.emailQueue.add(jobType, data),
                new Promise((_, reject) => setTimeout(() => reject(new Error(`Queue job confirmation timed out after ${timeoutMs}ms`)), timeoutMs).unref()),
            ]);
            logger_1.logger.info('BullMQ email job enqueued successfully', {
                correlationId,
                jobId: job.id,
                queue: queue_constants_1.QueueName.EMAIL,
                jobType,
                queueState: 'waiting',
                recipientDomain,
            });
            return job;
        }
        catch (err) {
            if (options?.fallbackToDirectSmtp !== false) {
                // Direct SMTP delivery fallback ensures critical user emails from info@hostelghar.com
                // are reliably delivered immediately even when Redis port is blocked or queue times out
                logger_1.logger.warn('BullMQ enqueue failed or timed out; attempting direct SMTP fallback', {
                    correlationId,
                    queue: queue_constants_1.QueueName.EMAIL,
                    jobType,
                    error: err?.message || String(err),
                    recipientDomain,
                });
                const { emailSenderService } = await Promise.resolve().then(() => __importStar(require('../services/email/email-sender.service')));
                await emailSenderService.send({
                    to: data.to,
                    subject: data.subject,
                    body: data.body || '',
                    ...(data.html ? { html: data.html } : {}),
                }, { correlationId });
                return { id: 'direct-smtp-fallback', name: jobType, data };
            }
            throw err;
        }
    }
    /**
     * Helper to dispatch bulk email jobs to BullMQ queue in a single operation
     */
    async queueEmailsBulk(jobs, options) {
        if (jobs.length === 0)
            return [];
        const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
        const isPassenger = typeof global.PhusionPassenger !== 'undefined' ||
            typeof process.env.PASSENGER_APP_ENV !== 'undefined' ||
            typeof process.env.PASSENGER_SPAWN_METHOD !== 'undefined' ||
            process.env.PASSENGER_MODE === 'true';
        const isDirectSmtpMode = !isTest &&
            (envConfig_1.dotEnvConfig.USE_DIRECT_SMTP ||
                !envConfig_1.dotEnvConfig.ENABLE_REDIS ||
                (isPassenger && process.env.ENABLE_WORKERS !== 'true') ||
                redis_config_1.redisClient.status !== 'ready');
        if (isDirectSmtpMode) {
            const { emailSenderService } = await Promise.resolve().then(() => __importStar(require('../services/email/email-sender.service')));
            await Promise.allSettled(jobs.map((job) => emailSenderService.send({
                to: job.data.to,
                subject: job.data.subject,
                body: job.data.body || '',
                ...(job.data.html ? { html: job.data.html } : {}),
            }, { correlationId: job.data.context?.correlationId })));
            return jobs.map((j, i) => ({ id: `direct-bulk-${i}`, name: j.name, data: j.data }));
        }
        const timeoutMs = options?.timeoutMs ?? 5000;
        return await Promise.race([
            queue_factory_1.emailQueue.addBulk(jobs),
            new Promise((_, reject) => setTimeout(() => reject(new Error(`Bulk queue jobs confirmation timed out after ${timeoutMs}ms`)), timeoutMs).unref()),
        ]);
    }
    /**
     * Helper to dispatch push/in-app notification to BullMQ queue
     */
    async queueNotification(data) {
        return await queue_factory_1.notificationQueue.add(queue_constants_1.JobType.SEND_IN_APP_NOTIFICATION, data);
    }
    broadcastRealtime(event) {
        try {
            if (event.userId) {
                socket_server_1.socketServer.toUser(event.userId, event.type, event.payload);
            }
            else if (event.hostelId) {
                socket_server_1.socketServer.toHostel(event.hostelId, event.type, event.payload);
            }
            else if (event.role) {
                socket_server_1.socketServer.toRole(event.role, event.type, event.payload);
            }
            else {
                socket_server_1.socketServer.broadcast(event.type, event.payload);
            }
        }
        catch (err) {
            console.warn(`[EventDispatcher] Real-time broadcast failed: ${err.message}`);
        }
    }
    setupInternalHandlers() {
        // Example listener: when user registers, trigger welcome email
        this.on('USER_REGISTERED', async (event) => {
            if (event.payload?.email) {
                await this.queueEmail(queue_constants_1.JobType.SEND_WELCOME_EMAIL, {
                    to: event.payload.email,
                    subject: 'Welcome to HostelGhar!',
                    body: `Hi ${event.payload.firstName || 'User'}, welcome to HostelGhar platform.`,
                });
            }
        });
    }
}
exports.eventDispatcher = new AppEventDispatcher();
