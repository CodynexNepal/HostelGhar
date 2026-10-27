"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const api_1 = require("@opentelemetry/api");
const service = process.env.OTEL_SERVICE_NAME || 'hostelghar-api';
const environment = process.env.NODE_ENV || 'development';
const write = (level, message, fields = {}) => {
    const spanContext = api_1.trace.getActiveSpan()?.spanContext();
    const entry = {
        timestamp: new Date().toISOString(),
        level,
        service,
        environment,
        message,
        ...(spanContext?.traceId && { trace_id: spanContext.traceId }),
        ...(spanContext?.spanId && { span_id: spanContext.spanId }),
        ...fields,
    };
    const output = JSON.stringify(entry);
    if (level === 'error' || level === 'fatal') {
        process.stderr.write(`${output}\n`);
    }
    else {
        process.stdout.write(`${output}\n`);
    }
};
exports.logger = {
    debug: (message, fields) => write('debug', message, fields),
    info: (message, fields) => write('info', message, fields),
    warn: (message, fields) => write('warn', message, fields),
    error: (message, fields) => write('error', message, fields),
    fatal: (message, fields) => write('fatal', message, fields),
};
