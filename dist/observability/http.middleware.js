"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpLoggingMiddleware = void 0;
const node_crypto_1 = require("node:crypto");
const logger_1 = require("./logger");
const httpLoggingMiddleware = (req, res, next) => {
    const requestId = req.header('x-request-id') || (0, node_crypto_1.randomUUID)();
    const start = process.hrtime.bigint();
    res.setHeader('x-request-id', requestId);
    res.once('finish', () => {
        // CORS preflight (OPTIONS → 204) is answered by the `cors` middleware
        // before any controller runs. It is NOT an error / NOT a failed request.
        // Logging every preflight at `info` level buries the real GET/POST logs
        // and makes it look like "only 204s". Keep it at debug.
        if (req.method === 'OPTIONS') {
            logger_1.logger.debug('CORS preflight handled', {
                request_id: requestId,
                http_method: req.method,
                route: req.route?.path || req.path,
                status_code: res.statusCode,
                duration_ms: Math.round(Number(process.hrtime.bigint() - start) / 1e6),
            });
            return;
        }
        logger_1.logger.info('HTTP request completed', {
            request_id: requestId,
            http_method: req.method,
            route: req.route?.path || req.path,
            status_code: res.statusCode,
            duration_ms: Math.round(Number(process.hrtime.bigint() - start) / 1e6),
        });
    });
    next();
};
exports.httpLoggingMiddleware = httpLoggingMiddleware;
