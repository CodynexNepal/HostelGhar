// ──────────────────────────────────────────────────────────────────────────────
// FILE: circuit-breaker.util.ts
// PURPOSE: Enterprise Circuit Breaker pattern implementation using Opossum.
//          Protects downstream services (email, third-party APIs, S3/Cloudinary)
//          from cascading failures.
// ──────────────────────────────────────────────────────────────────────────────

import CircuitBreaker from 'opossum';
import { logger } from '../observability/logger';
import {
  circuitBreakerEvents,
  circuitBreakerLatency,
  circuitBreakerState,
} from '../observability/metrics';

export interface CircuitBreakerConfig<TI extends unknown[] = unknown[], TR = unknown> {
  timeout?: number;
  errorThresholdPercentage?: number;
  resetTimeout?: number;
  rollingCountTimeout?: number;
  rollingCountBuckets?: number;
  volumeThreshold?: number;
  capacity?: number;
  name?: string;
  fallback?: (...args: TI) => TR | Promise<TR>;
}

const defaultOptions: CircuitBreaker.Options = {
  timeout: 5000,
  errorThresholdPercentage: 50,
  resetTimeout: 10000,
  rollingCountTimeout: 10000,
  rollingCountBuckets: 10,
  volumeThreshold: 10,
  capacity: 100,
  allowWarmUp: false,
};

const breakers = new Map<string, CircuitBreaker>();

const recordState = (breaker: CircuitBreaker): void => {
  const state = breaker.opened ? 'open' : breaker.halfOpen ? 'half_open' : 'closed';
  for (const possibleState of ['closed', 'open', 'half_open']) {
    circuitBreakerState.set(
      { name: breaker.name, state: possibleState },
      possibleState === state ? 1 : 0,
    );
  }
};

/**
 * Creates a Circuit Breaker around an async action.
 *
 * @param action - Async function to be protected
 * @param options - Custom breaker options
 */
export function createCircuitBreaker<TI extends any[], TR>(
  action: (...args: TI) => Promise<TR>,
  options: CircuitBreakerConfig<TI, TR> = {},
): CircuitBreaker<TI, TR> {
  const name = options.name || action.name || 'CircuitBreaker';
  if (breakers.has(name)) {
    throw new Error(`Circuit breaker with name "${name}" is already registered.`);
  }

  const breakerOptions: CircuitBreaker.Options = {
    ...defaultOptions,
    ...options,
    name,
  };
  delete (breakerOptions as CircuitBreaker.Options & { fallback?: unknown }).fallback;

  const breaker = new CircuitBreaker<TI, TR>(action, breakerOptions);
  if (options.fallback) breaker.fallback(options.fallback);
  breakers.set(name, breaker);
  recordState(breaker);

  breaker.on('fire', () => circuitBreakerEvents.inc({ name, event: 'fire' }));
  breaker.on('success', (_result, latencyMs) => {
    circuitBreakerEvents.inc({ name, event: 'success' });
    circuitBreakerLatency.observe({ name, outcome: 'success' }, latencyMs / 1000);
  });
  breaker.on('failure', (error, latencyMs) => {
    circuitBreakerEvents.inc({ name, event: 'failure' });
    circuitBreakerLatency.observe({ name, outcome: 'failure' }, latencyMs / 1000);
    logger.error('Circuit breaker action failed', { breaker: name, error: error.message });
  });
  breaker.on('timeout', (error) => {
    circuitBreakerEvents.inc({ name, event: 'timeout' });
    logger.warn('Circuit breaker action timed out', { breaker: name, error: error.message });
  });
  breaker.on('reject', (error) => {
    circuitBreakerEvents.inc({ name, event: 'reject' });
    logger.warn('Circuit breaker rejected a call', { breaker: name, error: error.message });
  });
  breaker.on('fallback', (_result, error) => {
    circuitBreakerEvents.inc({ name, event: 'fallback' });
    logger.warn('Circuit breaker fallback executed', { breaker: name, error: error.message });
  });
  breaker.on('open', () => {
    circuitBreakerEvents.inc({ name, event: 'open' });
    recordState(breaker);
    logger.error('Circuit breaker opened', { breaker: name });
  });
  breaker.on('halfOpen', () => {
    circuitBreakerEvents.inc({ name, event: 'half_open' });
    recordState(breaker);
    logger.warn('Circuit breaker entered half-open state', { breaker: name });
  });
  breaker.on('close', () => {
    circuitBreakerEvents.inc({ name, event: 'close' });
    recordState(breaker);
    logger.info('Circuit breaker closed', { breaker: name });
  });
  breaker.on('shutdown', () => {
    circuitBreakerEvents.inc({ name, event: 'shutdown' });
    logger.info('Circuit breaker shut down', { breaker: name });
  });

  return breaker;
}

export const getCircuitBreakerHealth = (): Array<Record<string, unknown>> =>
  [...breakers.values()].map((breaker) => ({
    name: breaker.name,
    state: breaker.opened ? 'open' : breaker.halfOpen ? 'half_open' : 'closed',
    enabled: breaker.enabled,
    pendingClose: breaker.pendingClose,
    stats: breaker.stats,
  }));

export const shutdownCircuitBreakers = (): void => {
  for (const breaker of breakers.values()) breaker.shutdown();
  breakers.clear();
};
