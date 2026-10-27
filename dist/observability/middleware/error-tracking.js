"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorTrackingMiddleware = void 0;
const logger_1 = require("../logger");
const errorTrackingMiddleware = (error, req, _res, next) => {
    logger_1.logger.error('Unhandled request error', {
        request_id: req.header('x-request-id'),
        error: error instanceof Error ? error.message : String(error),
    });
    next(error);
};
exports.errorTrackingMiddleware = errorTrackingMiddleware;
