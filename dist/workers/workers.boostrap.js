"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: workers.boostrap.ts
// PURPOSE: Initializes all BullMQ background workers at application boot.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.shutdownWorkers = exports.bootstrapWorkers = void 0;
const email_worker_1 = require("./email.worker");
const notification_worker_1 = require("./notification.worker");
const audit_worker_1 = require("./audit.worker");
const resident_import_worker_1 = require("./resident-import.worker");
const fee_scheduler_job_1 = require("../jobs/fee-scheduler.job");
let emailWorker = null;
let notificationWorker = null;
let auditWorker = null;
let feeWorker = null;
let residentImportWorker = null;
const bootstrapWorkers = () => {
    console.log('🚀 Initializing BullMQ background workers...');
    emailWorker = new email_worker_1.EmailWorker();
    notificationWorker = new notification_worker_1.NotificationWorker();
    auditWorker = new audit_worker_1.AuditLogWorker();
    feeWorker = new fee_scheduler_job_1.FeeAutomationWorker();
    residentImportWorker = new resident_import_worker_1.ResidentImportWorker();
    // Register scheduled cron jobs
    (0, fee_scheduler_job_1.registerMonthlyFeeCron)().catch((err) => {
        console.error('Failed to register fee cron job:', err.message);
    });
    console.log('✅ BullMQ background workers active (Email, Notification, Audit, Fee Automation, Resident Import)');
};
exports.bootstrapWorkers = bootstrapWorkers;
const shutdownWorkers = async () => {
    console.log('🛑 Gracefully shutting down BullMQ workers...');
    await Promise.allSettled([
        emailWorker?.close(),
        notificationWorker?.close(),
        auditWorker?.close(),
        feeWorker?.close(),
        residentImportWorker?.close(),
    ]);
    emailWorker = null;
    notificationWorker = null;
    auditWorker = null;
    feeWorker = null;
    residentImportWorker = null;
    console.log('✅ BullMQ workers stopped');
};
exports.shutdownWorkers = shutdownWorkers;
