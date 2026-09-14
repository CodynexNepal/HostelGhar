import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

let sdk: NodeSDK | undefined;
let telemetryStarted = false;

export const startTelemetry = (): void => {
  if (
    telemetryStarted ||
    process.env.OTEL_SDK_DISABLED === 'true' ||
    !process.env.OTEL_EXPORTER_OTLP_ENDPOINT
  ) {
    return;
  }

  sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter({
      url: `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT.replace(/\/$/, '')}/v1/traces`,
    }),
    instrumentations: [getNodeAutoInstrumentations()],
    serviceName: process.env.OTEL_SERVICE_NAME || 'hostelghar-api',
  });
  sdk.start();
  telemetryStarted = true;
};

export const shutdownTelemetry = async (): Promise<void> => {
  if (sdk) await sdk.shutdown();
};
