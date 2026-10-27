"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const statusCode_interface_1 = require("../constant/statusCode.interface");
const envConfig_1 = require("../configs/envConfig");
const cors_config_1 = require("../configs/cors.config");
const errorHandler = (err, req, res, _next) => {
    (0, cors_config_1.applyCorsHeaders)(req, res);
    const statusCode = err.statusCode || statusCode_interface_1.STATUS_CODE.INTERNAL_SERVER_ERROR;
    const message = err.message || 'Internal Server Error';
    res.status(statusCode).json({
        success: false,
        message,
        ...(envConfig_1.dotEnvConfig.NODE_ENV !== 'production' && { stack: err.stack }),
    });
};
exports.errorHandler = errorHandler;
