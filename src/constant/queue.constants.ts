// ──────────────────────────────────────────────────────────────────────────────
// FILE: queue.constants.ts
// PURPOSE: Unified definitions of Queue names, Job types, and Event names.
// ──────────────────────────────────────────────────────────────────────────────

export enum QueueName {
  EMAIL = 'email-queue',
  NOTIFICATION = 'notification-queue',
  AUDIT_LOG = 'audit-log-queue',
  SYSTEM_EVENT = 'system-event-queue',
  RESIDENT_IMPORT = 'resident-import-queue',
}

export enum JobType {
  // Email Jobs
  SEND_WELCOME_EMAIL = 'SEND_WELCOME_EMAIL',
  SEND_OTP = 'SEND_OTP',
  SEND_PASSWORD_RESET = 'SEND_PASSWORD_RESET',
  SEND_INVOICE_EMAIL = 'SEND_INVOICE_EMAIL',

  // Notification Jobs
  SEND_PUSH_NOTIFICATION = 'SEND_PUSH_NOTIFICATION',
  SEND_IN_APP_NOTIFICATION = 'SEND_IN_APP_NOTIFICATION',

  // Audit Logs
  LOG_USER_ACTIVITY = 'LOG_USER_ACTIVITY',
  LOG_SECURITY_ALERT = 'LOG_SECURITY_ALERT',

  // System Events
  PROCESS_DOMAIN_EVENT = 'PROCESS_DOMAIN_EVENT',

  // Resident bulk import (background CSV processing)
  RESIDENT_CSV_IMPORT = 'RESIDENT_CSV_IMPORT',
}

export enum SocketEvent {
  // Connection & System
  CONNECT = 'connection',
  DISCONNECT = 'disconnect',
  AUTHENTICATE = 'authenticate',
  ERROR = 'error',

  // Domain Realtime Events
  USER_STATUS_CHANGED = 'user:status_changed',
  NOTIFICATION_RECEIVED = 'notification:received',
  HOSTEL_UPDATED = 'hostel:updated',
  ROOM_STATUS_CHANGED = 'room:status_changed',
  LEAVE_STATUS_CHANGED = 'leave:status_changed',
  PAYMENT_PROCESSED = 'payment:processed',
  BOOKING_CONFIRMED = 'booking:confirmed',
  LIVE_ANNOUNCEMENT = 'announcement:broadcast',
  RESIDENT_IMPORT_PROGRESS = 'resident:import_progress',
  RESIDENT_IMPORT_COMPLETED = 'resident:import_completed',
}
