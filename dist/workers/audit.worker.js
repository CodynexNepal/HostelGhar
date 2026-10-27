"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: audit.worker.ts
// PURPOSE: Background worker that processes and persists audit logs asynchronously.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLogWorker = void 0;
const base_worker_1 = require("./base.worker");
const queue_constants_1 = require("../constant/queue.constants");
class AuditLogWorker extends base_worker_1.BaseWorker {
    constructor() {
        super(queue_constants_1.QueueName.AUDIT_LOG, 10);
    }
    async process(job) {
        const payload = job.data;
        console.log(`📝 [AuditLog] Action "${payload.action}" on "${payload.resource}" by user "${payload.userId || 'anonymous'}"`);
        return { logged: true };
    }
}
exports.AuditLogWorker = AuditLogWorker;
