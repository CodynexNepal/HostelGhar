"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metricsHandler = exports.metricsMiddleware = exports.circuitBreakerState = exports.circuitBreakerLatency = exports.circuitBreakerEvents = exports.httpCompressionSavedBytesTotal = exports.httpResponsesCompressedTotal = exports.httpActiveRequests = exports.httpRequestDuration = exports.httpRequestsTotal = exports.metricsRegistry = void 0;
const prom_client_1 = require("prom-client");
exports.metricsRegistry = new prom_client_1.Registry();
(0, prom_client_1.collectDefaultMetrics)({ register: exports.metricsRegistry, prefix: 'hostelghar_' });
exports.httpRequestsTotal = new prom_client_1.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests.',
    labelNames: ['method', 'route', 'status_code'],
    registers: [exports.metricsRegistry],
});
exports.httpRequestDuration = new prom_client_1.Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds.',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [exports.metricsRegistry],
});
exports.httpActiveRequests = new prom_client_1.Gauge({
    name: 'http_active_requests',
    help: 'Number of HTTP requests currently being processed.',
    registers: [exports.metricsRegistry],
});
// Response compression (Brotli/gzip/deflate) — proves the bandwidth saved by
// src/performance/http/compression.ts straight from /metrics.
exports.httpResponsesCompressedTotal = new prom_client_1.Counter({
    name: 'http_responses_compressed_total',
    help: 'Responses sent with a compressed body, by content coding.',
    labelNames: ['encoding'],
    registers: [exports.metricsRegistry],
});
exports.httpCompressionSavedBytesTotal = new prom_client_1.Counter({
    name: 'http_compression_saved_bytes_total',
    help: 'Bytes saved by compressing responses (uncompressed minus compressed), by coding.',
    labelNames: ['encoding'],
    registers: [exports.metricsRegistry],
});
exports.circuitBreakerEvents = new prom_client_1.Counter({
    name: 'circuit_breaker_events_total',
    help: 'Circuit breaker lifecycle and execution events.',
    labelNames: ['name', 'event'],
    registers: [exports.metricsRegistry],
});
exports.circuitBreakerLatency = new prom_client_1.Histogram({
    name: 'circuit_breaker_action_duration_seconds',
    help: 'Duration of protected downstream actions.',
    labelNames: ['name', 'outcome'],
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [exports.metricsRegistry],
});
exports.circuitBreakerState = new prom_client_1.Gauge({
    name: 'circuit_breaker_state',
    help: 'Current circuit breaker state. One state label is set to 1.',
    labelNames: ['name', 'state'],
    registers: [exports.metricsRegistry],
});
const routeLabel = (req) => {
    const route = req.route?.path;
    if (typeof route === 'string')
        return route;
    if (req.path === '/metrics' || req.path.startsWith('/health'))
        return req.path;
    return 'unmatched';
};
const metricsMiddleware = (req, res, next) => {
    const start = process.hrtime.bigint();
    exports.httpActiveRequests.inc();
    res.once('finish', () => {
        const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
        const labels = {
            method: req.method,
            route: routeLabel(req),
            status_code: String(res.statusCode),
        };
        exports.httpRequestsTotal.inc(labels);
        exports.httpRequestDuration.observe(labels, durationSeconds);
        exports.httpActiveRequests.dec();
    });
    next();
};
exports.metricsMiddleware = metricsMiddleware;
const metricsHandler = async (_req, res) => {
    res.setHeader('Content-Type', exports.metricsRegistry.contentType);
    res.end(await exports.metricsRegistry.metrics());
};
exports.metricsHandler = metricsHandler;
