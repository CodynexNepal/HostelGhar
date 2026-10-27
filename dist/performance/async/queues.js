"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queuePerformancePolicy = void 0;
exports.queuePerformancePolicy = Object.freeze({
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
});
