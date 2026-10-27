"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisCheckDuration = exports.redisReady = exports.databaseCheckDuration = exports.databaseReady = void 0;
const prom_client_1 = require("prom-client");
const metrics_1 = require("../metrics");
exports.databaseReady = new prom_client_1.Gauge({
    name: 'database_ready',
    help: 'Whether the PostgreSQL connection is initialized.',
    registers: [metrics_1.metricsRegistry],
});
exports.databaseCheckDuration = new prom_client_1.Gauge({
    name: 'database_healthcheck_duration_seconds',
    help: 'Duration of the most recent PostgreSQL health check in seconds.',
    registers: [metrics_1.metricsRegistry],
});
exports.redisReady = new prom_client_1.Gauge({
    name: 'redis_ready',
    help: 'Whether the Redis connection passed its most recent health check.',
    registers: [metrics_1.metricsRegistry],
});
exports.redisCheckDuration = new prom_client_1.Gauge({
    name: 'redis_healthcheck_duration_seconds',
    help: 'Duration of the most recent Redis health check in seconds.',
    registers: [metrics_1.metricsRegistry],
});
