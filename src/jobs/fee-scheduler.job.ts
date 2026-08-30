// ──────────────────────────────────────────────────────────────────────────────
// FILE: fee-scheduler.job.ts
// PURPOSE: Automated BullMQ recurring cron job executing on the 1st of every month.
// ──────────────────────────────────────────────────────────────────────────────

import { systemEventQueue } from '../queue/queue.factory';
import { BaseWorker } from '../workers/base.worker';
import { QueueName } from '../constant/queue.constants';
import { Job } from 'bullmq';
import { feeService } from '../services/fee/fee.service';

export const SCHEDULED_MONTHLY_FEE_JOB = 'SCHEDULED_MONTHLY_FEE_JOB';

/**
 * Registers the BullMQ monthly fee cron schedule (1st day of every month at 00:01 AM)
 */
export const registerMonthlyFeeCron = async (): Promise<void> => {
  await systemEventQueue.upsertJobScheduler(
    'monthly-fee-cron-job',
    {
      pattern: '1 0 1 * *', // 00:01 on the 1st of every month
    },
    {
      name: SCHEDULED_MONTHLY_FEE_JOB,
      data: {},
    },
  );
  console.log(
    '⏰ [Scheduler] Monthly fee cron job registered (Every 1st of the month at 00:01 AM)',
  );
};

/**
 * Worker that handles the automated fee execution when cron triggers
 */
export class FeeAutomationWorker extends BaseWorker {
  constructor() {
    super(QueueName.SYSTEM_EVENT, 1);
  }

  async process(job: Job): Promise<any> {
    if (job.name === SCHEDULED_MONTHLY_FEE_JOB) {
      return await feeService.generateMonthlyFeesForAllHostels();
    }
    return { skipped: true };
  }
}
