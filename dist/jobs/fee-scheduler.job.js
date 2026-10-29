"use strict";
// ─────────────────────────────────────────────────────────────
// FILE: fee-scheduler.job.ts
// PURPOSE: Daily checker that fires monthly billing ONLY on Nepali 1st.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeeAutomationWorker = exports.registerMonthlyFeeCron = exports.TRIGGER_MONTHLY_FEES_JOB = exports.SCHEDULED_NEPALI_FEE_CHECK_JOB = exports.SCHEDULED_MONTHLY_FEE_JOB = void 0;
const queue_factory_1 = require("../queue/queue.factory");
const base_worker_1 = require("../workers/base.worker");
const queue_constants_1 = require("../constant/queue.constants");
const fee_service_1 = require("../services/fee/fee.service");
const nepali_date_util_1 = require("../utils/nepali-date.util");
exports.SCHEDULED_MONTHLY_FEE_JOB = 'SCHEDULED_MONTHLY_FEE_JOB';
exports.SCHEDULED_NEPALI_FEE_CHECK_JOB = 'SCHEDULED_NEPALI_FEE_CHECK_JOB';
exports.TRIGGER_MONTHLY_FEES_JOB = 'TRIGGER_MONTHLY_FEES_JOB';
/**
 * Daily 00:05 check. The worker skips unless today is Nepali 1st (gatey).
 * Nepali months are 29-32 days, so an AD "1st of month" cron can never match.
 */
const registerMonthlyFeeCron = async () => {
    await queue_factory_1.systemEventQueue.upsertJobScheduler('nepali-monthly-fee-cron-job', {
        pattern: '5 0 * * *',
    }, {
        name: exports.SCHEDULED_NEPALI_FEE_CHECK_JOB,
        data: {},
    });
    console.log('⏰ [Scheduler] Nepali monthly fee cron registered (daily 00:05 check; bills only on Nepali 1st)');
};
exports.registerMonthlyFeeCron = registerMonthlyFeeCron;
/**
 * Worker that handles the automated fee execution when cron triggers
 */
class FeeAutomationWorker extends base_worker_1.BaseWorker {
    constructor() {
        super(queue_constants_1.QueueName.SYSTEM_EVENT, 1);
    }
    async process(job) {
        if (job.name === exports.TRIGGER_MONTHLY_FEES_JOB) {
            const result = await fee_service_1.feeService.generateMonthlyFeesForAllHostels(job.data?.billingMonth, job.data?.billingYear, job.data?.baseFee, { enforceNepaliFirstDay: false, hostelId: job.data?.hostelId });
            return result;
        }
        if (job.name === exports.SCHEDULED_NEPALI_FEE_CHECK_JOB || job.name === exports.SCHEDULED_MONTHLY_FEE_JOB) {
            const now = new Date();
            const bs = (0, nepali_date_util_1.toNepaliDate)(now);
            if (!(0, nepali_date_util_1.isFirstDayOfNepaliMonth)(now)) {
                return { skipped: true, reason: 'Not Nepali 1st', bs };
            }
            const result = await fee_service_1.feeService.generateMonthlyFeesForAllHostels(undefined, undefined, 10500, {
                enforceNepaliFirstDay: true,
                now,
            });
            return { ...result, bsMonth: (0, nepali_date_util_1.formatNepaliMonthYear)(bs) };
        }
        return { skipped: true };
    }
}
exports.FeeAutomationWorker = FeeAutomationWorker;
