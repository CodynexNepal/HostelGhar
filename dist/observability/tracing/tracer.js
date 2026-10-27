"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tracer = void 0;
const api_1 = require("@opentelemetry/api");
exports.tracer = api_1.trace.getTracer(process.env.OTEL_SERVICE_NAME || 'hostelghar-api');
