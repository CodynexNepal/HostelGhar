"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFoundHandler = void 0;
const statusCode_interface_1 = require("../constant/statusCode.interface");
const cors_config_1 = require("../configs/cors.config");
/**
 * 404 JSON fallthrough. Express 5 does NOT auto-respond on unmatched paths —
 * without this, a wrong URL prefix hangs as (pending) in DevTools forever.
 * Must be registered AFTER all routes but BEFORE the error handler.
 */
const notFoundHandler = (req, res) => {
    (0, cors_config_1.applyCorsHeaders)(req, res);
    res.status(statusCode_interface_1.STATUS_CODE.NOT_FOUND).json({
        success: false,
        message: `Route not found: ${req.method} ${req.originalUrl}`,
    });
};
exports.notFoundHandler = notFoundHandler;
