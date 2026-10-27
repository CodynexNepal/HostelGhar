// ──────────────────────────────────────────────────────────────────────────────
// FILE: base.worker.ts
// PURPOSE: Abstract Base Worker encapsulating BullMQ worker logic, circuit
//          breaker hooks, lifecycle event handling, and DLQ tracking.
// ──────────────────────────────────────────────────────────────────────────────

import { Worker, Job, WorkerOptions } from 'bullmq';
import { createRedisClient } from '../configs/redis.config';
import { QueueName } from '../constant/queue.constants';
import { logger } from '../observability/logger';

export abstract class BaseWorker<TData = any, TResult = any> {
  protected worker: Worker;
  public readonly queueName: QueueName;
  private readonly connection: import('ioredis').default;

  constructor(
    queueName: QueueName,
    concurrency: number = 5,
    customOptions?: Partial<WorkerOptions>,
  ) {
    this.queueName = queueName;
    this.connection = createRedisClient(`worker:${queueName}`);

    this.worker = new Worker<TData, TResult>(
      queueName,
      async (job: Job<TData, TResult>) => {
        return this.process(job);
      },
      {
        connection: this.connection,
        concurrency,
        ...customOptions,
      },
    );

    this.setupListeners();
  }

  /**
   * The actual processing method to be implemented by child workers.
   */
  abstract process(job: Job<TData, TResult>): Promise<TResult>;

  private setupListeners(): void {
    this.worker.on('completed', (job: Job) => {
      logger.info('BullMQ worker job completed successfully', {
        jobId: job.id,
        queue: this.queueName,
        jobName: job.name,
        attemptsMade: job.attemptsMade,
      });
    });

    this.worker.on('failed', (job: Job | undefined, err: Error) => {
      if (job) {
        const attemptsMade = job.attemptsMade;
        const maxAttempts = job.opts.attempts || 1;

        if (attemptsMade < maxAttempts) {
          logger.warn('BullMQ worker job failed; retry scheduled', {
            status: 'RETRY_SCHEDULED',
            jobId: job.id,
            queue: this.queueName,
            jobName: job.name,
            attemptsMade,
            maxAttempts,
            error: err.message,
            errorCode: (err as any).code,
          });
        } else {
          this.onDeadLetter(job, err);
        }
      } else {
        logger.error('BullMQ worker failed without active job', {
          queue: this.queueName,
          error: err.message,
        });
      }
    });

    this.worker.on('error', (err: Error) => {
      logger.error('BullMQ worker critical error', {
        queue: this.queueName,
        error: err.message,
      });
    });
  }

  /**
   * Hook when a job exhausts all retries (Dead Letter Queue handling).
   * Note: We NEVER log raw payload data here to protect tokens and passwords.
   */
  protected onDeadLetter(job: Job, err: Error): void {
    logger.error('BullMQ job moved to Dead Letter state', {
      status: 'DELIVERY_FAILED',
      jobId: job.id,
      queue: this.queueName,
      jobName: job.name,
      attemptsMade: job.attemptsMade,
      error: err.message,
      errorCode: (err as any).code,
    });
  }

  public async close(): Promise<void> {
    await this.worker.close();
    await this.connection.quit().catch(() => this.connection.disconnect());
  }
}
