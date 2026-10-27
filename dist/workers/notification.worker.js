"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: notification.worker.ts
// PURPOSE: Background worker processing push/in-app notifications and streaming
//          live alerts directly to connected users via Socket.io / Redis PubSub.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationWorker = void 0;
const base_worker_1 = require("./base.worker");
const queue_constants_1 = require("../constant/queue.constants");
const socket_server_1 = require("../socket/socket.server");
class NotificationWorker extends base_worker_1.BaseWorker {
    constructor() {
        super(queue_constants_1.QueueName.NOTIFICATION, 10);
    }
    async process(job) {
        const payload = job.data;
        // Real-time dispatch to Socket.io clients
        if (payload.userId) {
            socket_server_1.socketServer.toUser(payload.userId, queue_constants_1.SocketEvent.NOTIFICATION_RECEIVED, payload);
        }
        else if (payload.hostelId) {
            socket_server_1.socketServer.toHostel(payload.hostelId, queue_constants_1.SocketEvent.NOTIFICATION_RECEIVED, payload);
        }
        else if (payload.role) {
            socket_server_1.socketServer.toRole(payload.role, queue_constants_1.SocketEvent.NOTIFICATION_RECEIVED, payload);
        }
        else {
            socket_server_1.socketServer.broadcast(queue_constants_1.SocketEvent.NOTIFICATION_RECEIVED, payload);
        }
        return { delivered: true, timestamp: new Date() };
    }
}
exports.NotificationWorker = NotificationWorker;
