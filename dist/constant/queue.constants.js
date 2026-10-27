"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: queue.constants.ts
// PURPOSE: Unified definitions of Queue names, Job types, and Event names.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocketEvent = exports.JobType = exports.QueueName = void 0;
var QueueName;
(function (QueueName) {
    QueueName["EMAIL"] = "email-queue";
    QueueName["NOTIFICATION"] = "notification-queue";
    QueueName["AUDIT_LOG"] = "audit-log-queue";
    QueueName["SYSTEM_EVENT"] = "system-event-queue";
    QueueName["RESIDENT_IMPORT"] = "resident-import-queue";
})(QueueName || (exports.QueueName = QueueName = {}));
var JobType;
(function (JobType) {
    // Email Jobs
    JobType["SEND_WELCOME_EMAIL"] = "SEND_WELCOME_EMAIL";
    JobType["SEND_OTP"] = "SEND_OTP";
    JobType["SEND_PASSWORD_RESET"] = "SEND_PASSWORD_RESET";
    JobType["SEND_INVOICE_EMAIL"] = "SEND_INVOICE_EMAIL";
    // Notification Jobs
    JobType["SEND_PUSH_NOTIFICATION"] = "SEND_PUSH_NOTIFICATION";
    JobType["SEND_IN_APP_NOTIFICATION"] = "SEND_IN_APP_NOTIFICATION";
    // Audit Logs
    JobType["LOG_USER_ACTIVITY"] = "LOG_USER_ACTIVITY";
    JobType["LOG_SECURITY_ALERT"] = "LOG_SECURITY_ALERT";
    // System Events
    JobType["PROCESS_DOMAIN_EVENT"] = "PROCESS_DOMAIN_EVENT";
    // Resident bulk import (background CSV processing)
    JobType["RESIDENT_CSV_IMPORT"] = "RESIDENT_CSV_IMPORT";
})(JobType || (exports.JobType = JobType = {}));
var SocketEvent;
(function (SocketEvent) {
    // Connection & System
    SocketEvent["CONNECT"] = "connection";
    SocketEvent["DISCONNECT"] = "disconnect";
    SocketEvent["AUTHENTICATE"] = "authenticate";
    SocketEvent["ERROR"] = "error";
    // Domain Realtime Events
    SocketEvent["USER_STATUS_CHANGED"] = "user:status_changed";
    SocketEvent["NOTIFICATION_RECEIVED"] = "notification:received";
    SocketEvent["HOSTEL_UPDATED"] = "hostel:updated";
    SocketEvent["ROOM_STATUS_CHANGED"] = "room:status_changed";
    SocketEvent["LEAVE_STATUS_CHANGED"] = "leave:status_changed";
    SocketEvent["PAYMENT_PROCESSED"] = "payment:processed";
    SocketEvent["BOOKING_CONFIRMED"] = "booking:confirmed";
    SocketEvent["LIVE_ANNOUNCEMENT"] = "announcement:broadcast";
    SocketEvent["RESIDENT_IMPORT_PROGRESS"] = "resident:import_progress";
    SocketEvent["RESIDENT_IMPORT_COMPLETED"] = "resident:import_completed";
})(SocketEvent || (exports.SocketEvent = SocketEvent = {}));
