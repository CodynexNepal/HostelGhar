// ──────────────────────────────────────────────────────────────────────────────
// FILE: workers.boostrap.ts
// PURPOSE: Initializes all BullMQ background workers at application boot.
// ──────────────────────────────────────────────────────────────────────────────

import { EmailWorker } from './email.worker';
import { NotificationWorker } from './notification.worker';
import { AuditLogWorker } from './audit.worker';
import { FeeAutomationWorker, registerMonthlyFeeCron } from '../jobs/fee-scheduler.job';

let emailWorker: EmailWorker | null = null;
let notificationWorker: NotificationWorker | null = null;
let auditWorker: AuditLogWorker | null = null;
let feeWorker: FeeAutomationWorker | null = null;

export const bootstrapWorkers = (): void => {
  console.log('🚀 Initializing BullMQ background workers...');
  emailWorker = new EmailWorker();
  notificationWorker = new NotificationWorker();
  auditWorker = new AuditLogWorker();
  feeWorker = new FeeAutomationWorker();

  // Register scheduled cron jobs
  registerMonthlyFeeCron().catch((err) => {
    console.error('Failed to register fee cron job:', err.message);
  });

  console.log('✅ BullMQ background workers active (Email, Notification, Audit, Fee Automation)');
};

export const shutdownWorkers = async (): Promise<void> => {
  console.log('🛑 Gracefully shutting down BullMQ workers...');
  await Promise.all([
    emailWorker?.close(),
    notificationWorker?.close(),
    auditWorker?.close(),
    feeWorker?.close(),
  ]);
  console.log('✅ BullMQ workers stopped');
};
