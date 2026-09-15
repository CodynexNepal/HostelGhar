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
  template?: string;
  context?: Record<string, any>;
}

const externalEmailService = async (payload: EmailJobPayload): Promise<boolean> => {
  return emailSenderService.send({
    to: payload.to,
    subject: payload.subject,
    body: payload.body || '',
  });
};

const emailCircuitBreaker = createCircuitBreaker(externalEmailService, {
  name: 'EmailServiceBreaker',
  timeout: 8000,
  errorThresholdPercentage: 50,
  resetTimeout: 15000,
  fallback: async (payload: EmailJobPayload) => {
    logger.warn('Email circuit breaker fallback executed', {
      breaker: 'EmailServiceBreaker',
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
    const { name, data } = job;
    console.log(`Processing email job ${name} for ${data.to}`);

    switch (name) {
      case JobType.SEND_WELCOME_EMAIL:
      case JobType.SEND_OTP:
      case JobType.SEND_PASSWORD_RESET:
      case JobType.SEND_INVOICE_EMAIL:
        return await emailCircuitBreaker.fire(data);

      default:
        console.warn(`Unknown email job type: ${name}`);
        return await emailCircuitBreaker.fire(data);
    }
  }
}
