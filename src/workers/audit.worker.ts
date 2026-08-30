// ──────────────────────────────────────────────────────────────────────────────
// FILE: audit.worker.ts
// PURPOSE: Background worker that processes and persists audit logs asynchronously.
// ──────────────────────────────────────────────────────────────────────────────

import { Job } from 'bullmq';
import { BaseWorker } from './base.worker';
import { QueueName } from '../constant/queue.constants';

export interface AuditLogJobPayload {
  userId?: string;
  action: string;
  resource: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  timestamp?: string;
}

export class AuditLogWorker extends BaseWorker<AuditLogJobPayload> {
  constructor() {
    super(QueueName.AUDIT_LOG, 10);
  }

  async process(job: Job<AuditLogJobPayload>): Promise<any> {
    const payload = job.data;
    console.log(
      `📝 [AuditLog] Action "${payload.action}" on "${payload.resource}" by user "${payload.userId || 'anonymous'}"`,
    );
    return { logged: true };
  }
}
