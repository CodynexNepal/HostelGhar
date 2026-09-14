import { Gauge } from 'prom-client';
import { metricsRegistry } from '../metrics';

export const databaseReady = new Gauge({
  name: 'database_ready',
  help: 'Whether the PostgreSQL connection is initialized.',
  registers: [metricsRegistry],
});

export const databaseCheckDuration = new Gauge({
  name: 'database_healthcheck_duration_seconds',
  help: 'Duration of the most recent PostgreSQL health check in seconds.',
  registers: [metricsRegistry],
});

export const redisReady = new Gauge({
  name: 'redis_ready',
  help: 'Whether the Redis connection passed its most recent health check.',
  registers: [metricsRegistry],
});

export const redisCheckDuration = new Gauge({
  name: 'redis_healthcheck_duration_seconds',
  help: 'Duration of the most recent Redis health check in seconds.',
  registers: [metricsRegistry],
});
