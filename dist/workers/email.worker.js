"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailWorker = void 0;
const base_worker_1 = require("./base.worker");
const queue_constants_1 = require("../constant/queue.constants");
const circuit_breaker_util_1 = require("../utils/circuit-breaker.util");
const email_sender_service_1 = require("../services/email/email-sender.service");
const logger_1 = require("../observability/logger");
const normalize_util_1 = require("../utils/normalize.util");
const externalEmailService = async (payload, options) => {
    return email_sender_service_1.emailSenderService.send({
        to: payload.to,
        subject: payload.subject,
        body: payload.body || '',
        ...(payload.html ? { html: payload.html } : {}),
    }, options);
};
const emailCircuitBreaker = (0, circuit_breaker_util_1.createCircuitBreaker)(externalEmailService, {
    name: 'EmailServiceBreaker',
    timeout: 8000,
    errorThresholdPercentage: 50,
    resetTimeout: 15000,
    fallback: async (payload, options) => {
        logger_1.logger.warn('Email circuit breaker fallback executed', {
            breaker: 'EmailServiceBreaker',
            correlationId: options?.correlationId,
            jobId: options?.jobId,
            recipient: (0, normalize_util_1.maskEmail)(payload.to),
            recipient_domain: payload.to.split('@')[1] || 'unknown',
        });
        throw new Error('Email delivery failed after the circuit breaker fallback');
    },
});
class EmailWorker extends base_worker_1.BaseWorker {
    constructor() {
        super(queue_constants_1.QueueName.EMAIL, 5);
    }
    async process(job) {
        const { id: jobId, name: jobType, data } = job;
        const correlationId = data.context?.correlationId;
        const recipientDomain = data.to.split('@')[1] || 'unknown';
        const recipient = (0, normalize_util_1.maskEmail)(data.to);
        logger_1.logger.info('BullMQ email worker received job and started execution', {
            status: 'WORKER_STARTED',
            correlationId,
            jobId,
            queue: this.queueName,
            jobType,
            attemptsMade: job.attemptsMade,
            recipient,
            recipientDomain,
        });
        switch (jobType) {
            case queue_constants_1.JobType.SEND_WELCOME_EMAIL:
            case queue_constants_1.JobType.SEND_OTP:
            case queue_constants_1.JobType.SEND_PASSWORD_RESET:
            case queue_constants_1.JobType.SEND_INVOICE_EMAIL:
                return await emailCircuitBreaker.fire(data, { correlationId, jobId });
            default:
                logger_1.logger.warn('Unknown email job type encountered', {
                    correlationId,
                    jobId,
                    jobType,
                });
                return await emailCircuitBreaker.fire(data, { correlationId, jobId });
        }
    }
}
exports.EmailWorker = EmailWorker;
