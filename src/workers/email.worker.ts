import { Job } from 'bullmq';
import { BaseWorker } from './base.worker';
import { QueueName, JobType } from '../constant/queue.constants';
import { createCircuitBreaker } from '../utils/circuit-breaker.util';
import { emailSenderService } from '../services/email/email-sender.service';
import { logger } from '../observability/logger';

export interface EmailJobPayload {
  to: string;
  subject: string;
  body?: string;
  html?: string;
  template?: string;
  context?: Record<string, any>;
}

const externalEmailService = async (
  payload: EmailJobPayload,
  options?: { correlationId?: string | undefined; jobId?: string | undefined },
): Promise<boolean> => {
  return emailSenderService.send(
    {
      to: payload.to,
      subject: payload.subject,
      body: payload.body || '',
      ...(payload.html ? { html: payload.html } : {}),
    },
    options,
  );
};

const emailCircuitBreaker = createCircuitBreaker(externalEmailService, {
  name: 'EmailServiceBreaker',
  timeout: 8000,
  errorThresholdPercentage: 50,
  resetTimeout: 15000,
  fallback: async (
    payload: EmailJobPayload,
    options?: { correlationId?: string | undefined; jobId?: string | undefined },
  ) => {
    logger.warn('Email circuit breaker fallback executed', {
      breaker: 'EmailServiceBreaker',
      correlationId: options?.correlationId,
      jobId: options?.jobId,
      recipient_domain: payload.to.split('@')[1] || 'unknown',
    });
    throw new Error('Email delivery failed after the circuit breaker fallback');
  },
});

export class EmailWorker extends BaseWorker<EmailJobPayload> {
  constructor() {
    super(QueueName.EMAIL, 5);
  }

  async process(job: Job<EmailJobPayload>): Promise<any> {
    const { id: jobId, name: jobType, data } = job;
    const correlationId = data.context?.correlationId;
    const recipientDomain = data.to.split('@')[1] || 'unknown';

    logger.info('BullMQ email worker received job', {
      correlationId,
      jobId,
      queue: this.queueName,
      jobType,
      attemptsMade: job.attemptsMade,
      recipientDomain,
    });

    switch (jobType) {
      case JobType.SEND_WELCOME_EMAIL:
      case JobType.SEND_OTP:
      case JobType.SEND_PASSWORD_RESET:
      case JobType.SEND_INVOICE_EMAIL:
        return await emailCircuitBreaker.fire(data, { correlationId, jobId });

      default:
        logger.warn('Unknown email job type encountered', {
          correlationId,
          jobId,
          jobType,
        });
        return await emailCircuitBreaker.fire(data, { correlationId, jobId });
    }
  }
}
