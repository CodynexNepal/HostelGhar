// ─────────────────────────────────────────────────────────────
// FILE: fee-scheduler.job.ts
// PURPOSE: Daily checker that fires monthly billing ONLY on Nepali 1st.
// ──────────────────────────────────────────────────────────────────────────────

import { systemEventQueue } from '../queue/queue.factory';
import { BaseWorker } from '../workers/base.worker';
import { QueueName } from '../constant/queue.constants';
import { Job } from 'bullmq';
import { feeService } from '../services/fee/fee.service';
import {
  formatNepaliMonthYear,
  isFirstDayOfNepaliMonth,
  toNepaliDate,
} from '../utils/nepali-date.util';

export const SCHEDULED_MONTHLY_FEE_JOB = 'SCHEDULED_MONTHLY_FEE_JOB';
export const SCHEDULED_NEPALI_FEE_CHECK_JOB = 'SCHEDULED_NEPALI_FEE_CHECK_JOB';

/**
 * Daily 00:05 check. The worker skips unless today is Nepali 1st (gatey).
 * Nepali months are 29-32 days, so an AD "1st of month" cron can never match.
 */
export const registerMonthlyFeeCron = async (): Promise<void> => {
  await systemEventQueue.upsertJobScheduler(
    'nepali-monthly-fee-cron-job',
    {
      pattern: '5 0 * * *',
    },
    {
      name: SCHEDULED_NEPALI_FEE_CHECK_JOB,
      data: {},
    },
  );
  console.log(
    '⏰ [Scheduler] Nepali monthly fee cron registered (daily 00:05 check; bills only on Nepali 1st)',
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
    if (job.name === SCHEDULED_NEPALI_FEE_CHECK_JOB || job.name === SCHEDULED_MONTHLY_FEE_JOB) {
      const now = new Date();
      const bs = toNepaliDate(now);
      if (!isFirstDayOfNepaliMonth(now)) {
        return { skipped: true, reason: 'Not Nepali 1st', bs };
      }
      const result = await feeService.generateMonthlyFeesForAllHostels(undefined, undefined, 10500, {
        enforceNepaliFirstDay: true,
        now,
      });
      return { ...result, bsMonth: formatNepaliMonthYear(bs) };
    }
    return { skipped: true };
  }
}
