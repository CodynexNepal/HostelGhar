"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: base.worker.ts
// PURPOSE: Abstract Base Worker encapsulating BullMQ worker logic, circuit
//          breaker hooks, lifecycle event handling, and DLQ tracking.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseWorker = void 0;
const bullmq_1 = require("bullmq");
const redis_config_1 = require("../configs/redis.config");
const logger_1 = require("../observability/logger");
class BaseWorker {
    constructor(queueName, concurrency = 5, customOptions) {
        this.queueName = queueName;
        this.connection = (0, redis_config_1.createRedisClient)(`worker:${queueName}`);
        this.worker = new bullmq_1.Worker(queueName, async (job) => {
            return this.process(job);
        }, {
            connection: this.connection,
            concurrency,
            ...customOptions,
        });
        this.setupListeners();
    }
    setupListeners() {
        this.worker.on('completed', (job) => {
            logger_1.logger.info('BullMQ worker job completed successfully', {
                jobId: job.id,
                queue: this.queueName,
                jobName: job.name,
                attemptsMade: job.attemptsMade,
            });
        });
        this.worker.on('failed', (job, err) => {
            if (job) {
                const attemptsMade = job.attemptsMade;
                const maxAttempts = job.opts.attempts || 1;
                if (attemptsMade < maxAttempts) {
                    logger_1.logger.warn('BullMQ worker job failed; retry scheduled', {
                        status: 'RETRY_SCHEDULED',
                        jobId: job.id,
                        queue: this.queueName,
                        jobName: job.name,
                        attemptsMade,
                        maxAttempts,
                        error: err.message,
                        errorCode: err.code,
                    });
                }
                else {
                    this.onDeadLetter(job, err);
                }
            }
            else {
                logger_1.logger.error('BullMQ worker failed without active job', {
                    queue: this.queueName,
                    error: err.message,
                });
            }
        });
        this.worker.on('error', (err) => {
            logger_1.logger.error('BullMQ worker critical error', {
                queue: this.queueName,
                error: err.message,
            });
        });
    }
    /**
     * Hook when a job exhausts all retries (Dead Letter Queue handling).
     * Note: We NEVER log raw payload data here to protect tokens and passwords.
     */
    onDeadLetter(job, err) {
        logger_1.logger.error('BullMQ job moved to Dead Letter state', {
            status: 'DELIVERY_FAILED',
            jobId: job.id,
            queue: this.queueName,
            jobName: job.name,
            attemptsMade: job.attemptsMade,
            error: err.message,
            errorCode: err.code,
        });
    }
    async close() {
        await this.worker.close();
        await this.connection.quit().catch(() => this.connection.disconnect());
    }
}
exports.BaseWorker = BaseWorker;
