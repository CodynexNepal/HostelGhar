"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestTimeout = void 0;
const cors_config_1 = require("../../configs/cors.config");
const requestTimeout = (timeoutMs = 30000) => (req, res, next) => {
    res.setTimeout(timeoutMs, () => {
        if (!res.headersSent && !res.writableEnded) {
            (0, cors_config_1.applyCorsHeaders)(req, res);
            res.status(503).json({ success: false, message: 'Request timeout' });
        }
    });
    next();
};
exports.requestTimeout = requestTimeout;
