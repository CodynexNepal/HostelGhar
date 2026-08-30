// ──────────────────────────────────────────────────────────────────────────────
// FILE: base.worker.ts
// PURPOSE: Abstract Base Worker encapsulating BullMQ worker logic, circuit
//          breaker hooks, lifecycle event handling, and DLQ tracking.
// ──────────────────────────────────────────────────────────────────────────────

import { Worker, Job, WorkerOptions } from 'bullmq';
import { createRedisClient } from '../configs/redis.config';
import { QueueName } from '../constant/queue.constants';

export abstract class BaseWorker<TData = any, TResult = any> {
  protected worker: Worker;
  public readonly queueName: QueueName;

  constructor(
    queueName: QueueName,
    concurrency: number = 5,
    customOptions?: Partial<WorkerOptions>,
  ) {
    this.queueName = queueName;
    const connection = createRedisClient(`worker:${queueName}`);

    this.worker = new Worker<TData, TResult>(
      queueName,
      async (job: Job<TData, TResult>) => {
        return this.process(job);
      },
      {
        connection,
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
      console.log(
        `✅ [Worker:${this.queueName}] Job #${job.id} (${job.name}) completed successfully.`,
      );
    });

    this.worker.on('failed', (job: Job | undefined, err: Error) => {
      if (job) {
        console.error(
          `❌ [Worker:${this.queueName}] Job #${job.id} (${job.name}) failed (Attempt ${job.attemptsMade}/${job.opts.attempts}):`,
          err.message,
        );

        if (job.attemptsMade >= (job.opts.attempts || 1)) {
          this.onDeadLetter(job, err);
        }
      } else {
        console.error(
          `❌ [Worker:${this.queueName}] Worker failed without active job:`,
          err.message,
        );
      }
    });

    this.worker.on('error', (err: Error) => {
      console.error(`🚨 [Worker:${this.queueName}] Critical error:`, err.message);
    });
  }

  /**
   * Hook when a job exhausts all retries (Dead Letter Queue handling)
   */
  protected onDeadLetter(job: Job, err: Error): void {
    console.error(
      `💀 [DLQ:${this.queueName}] Job #${job.id} exhausted all retries and moved to Dead Letter state. Reason: ${err.message}`,
      JSON.stringify(job.data),
    );
  }

  public async close(): Promise<void> {
    await this.worker.close();
  }
}
