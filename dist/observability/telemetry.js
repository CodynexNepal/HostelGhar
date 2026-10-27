"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shutdownTelemetry = exports.startTelemetry = void 0;
const sdk_node_1 = require("@opentelemetry/sdk-node");
const auto_instrumentations_node_1 = require("@opentelemetry/auto-instrumentations-node");
const exporter_trace_otlp_http_1 = require("@opentelemetry/exporter-trace-otlp-http");
let sdk;
let telemetryStarted = false;
const startTelemetry = () => {
    if (telemetryStarted ||
        process.env.OTEL_SDK_DISABLED === 'true' ||
        !process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
        return;
    }
    sdk = new sdk_node_1.NodeSDK({
        traceExporter: new exporter_trace_otlp_http_1.OTLPTraceExporter({
            url: `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT.replace(/\/$/, '')}/v1/traces`,
        }),
        instrumentations: [(0, auto_instrumentations_node_1.getNodeAutoInstrumentations)()],
        serviceName: process.env.OTEL_SERVICE_NAME || 'hostelghar-api',
    });
    sdk.start();
    telemetryStarted = true;
};
exports.startTelemetry = startTelemetry;
const shutdownTelemetry = async () => {
    if (sdk)
        await sdk.shutdown();
};
exports.shutdownTelemetry = shutdownTelemetry;
