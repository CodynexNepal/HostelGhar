import { trace } from '@opentelemetry/api';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

type LogFields = Record<string, unknown>;

const service = process.env.OTEL_SERVICE_NAME || 'hostelghar-api';
const environment = process.env.NODE_ENV || 'development';

const write = (level: LogLevel, message: string, fields: LogFields = {}): void => {
  const spanContext = trace.getActiveSpan()?.spanContext();
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
  } else {
    process.stdout.write(`${output}\n`);
  }
};

export const logger = {
  debug: (message: string, fields?: LogFields) => write('debug', message, fields),
  info: (message: string, fields?: LogFields) => write('info', message, fields),
  warn: (message: string, fields?: LogFields) => write('warn', message, fields),
  error: (message: string, fields?: LogFields) => write('error', message, fields),
  fatal: (message: string, fields?: LogFields) => write('fatal', message, fields),
};
