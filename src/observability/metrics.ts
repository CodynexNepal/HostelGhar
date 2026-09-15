import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';
import { Request, Response, NextFunction } from 'express';

export const metricsRegistry = new Registry();
collectDefaultMetrics({ register: metricsRegistry, prefix: 'hostelghar_' });

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests.',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [metricsRegistry],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds.',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

export const httpActiveRequests = new Gauge({
  name: 'http_active_requests',
  help: 'Number of HTTP requests currently being processed.',
  registers: [metricsRegistry],
});

export const circuitBreakerEvents = new Counter({
  name: 'circuit_breaker_events_total',
  help: 'Circuit breaker lifecycle and execution events.',
  labelNames: ['name', 'event'] as const,
  registers: [metricsRegistry],
});

export const circuitBreakerLatency = new Histogram({
  name: 'circuit_breaker_action_duration_seconds',
  help: 'Duration of protected downstream actions.',
  labelNames: ['name', 'outcome'] as const,
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

export const circuitBreakerState = new Gauge({
  name: 'circuit_breaker_state',
  help: 'Current circuit breaker state. One state label is set to 1.',
  labelNames: ['name', 'state'] as const,
  registers: [metricsRegistry],
});

const routeLabel = (req: Request): string => {
  const route = req.route?.path;
  if (typeof route === 'string') return route;
  if (req.path === '/metrics' || req.path.startsWith('/health')) return req.path;
  return 'unmatched';
};

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const start = process.hrtime.bigint();
  httpActiveRequests.inc();

  res.once('finish', () => {
    const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
    const labels = {
      method: req.method,
      route: routeLabel(req),
      status_code: String(res.statusCode),
    };
    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, durationSeconds);
    httpActiveRequests.dec();
  });

  next();
};

export const metricsHandler = async (_req: Request, res: Response): Promise<void> => {
  res.setHeader('Content-Type', metricsRegistry.contentType);
  res.end(await metricsRegistry.metrics());
};
