// ──────────────────────────────────────────────────────────────────────────────
// FILE: circuit-breaker.util.ts
// PURPOSE: Enterprise Circuit Breaker pattern implementation using Opossum.
//          Protects downstream services (email, third-party APIs, S3/Cloudinary)
//          from cascading failures.
// ──────────────────────────────────────────────────────────────────────────────

import CircuitBreaker from 'opossum';

export interface CircuitBreakerConfig {
  timeout?: number; // Time in ms before a request fails (default 5000ms)
  errorThresholdPercentage?: number; // % of errors before opening circuit (default 50%)
  resetTimeout?: number; // Time in ms before attempting to close circuit (default 10000ms)
  name?: string;
  fallback?: (...args: any[]) => any;
}

const defaultOptions: CircuitBreaker.Options = {
  timeout: 5000,
  errorThresholdPercentage: 50,
  resetTimeout: 10000,
  rollingCountTimeout: 10000,
  rollingCountBuckets: 10,
  capacity: 100,
};

/**
 * Creates a Circuit Breaker around an async action.
 *
 * @param action - Async function to be protected
 * @param options - Custom breaker options
 */
export function createCircuitBreaker<TI extends any[], TR>(
  action: (...args: TI) => Promise<TR>,
  options: CircuitBreakerConfig = {},
): CircuitBreaker<TI, TR> {
  const breakerOptions: CircuitBreaker.Options = {
    ...defaultOptions,
    ...options,
    name: options.name || action.name || 'CircuitBreaker',
  };

  const breaker = new CircuitBreaker<TI, TR>(action, breakerOptions);

  if (options.fallback) {
    breaker.fallback(options.fallback);
  }

  // Lifecycle monitoring & logging
  breaker.on('open', () => {
    console.warn(
      `🚨 [CircuitBreaker:${breaker.name}] OPENED - Failure threshold reached! Fast-failing calls.`,
    );
  });

  breaker.on('halfOpen', () => {
    console.info(
      `🔄 [CircuitBreaker:${breaker.name}] HALF-OPEN - Testing downstream service recovery.`,
    );
  });

  breaker.on('close', () => {
    console.info(
      `✅ [CircuitBreaker:${breaker.name}] CLOSED - Service is healthy. Normal operations resumed.`,
    );
  });

  breaker.on('fallback', (result) => {
    console.warn(`🛡️ [CircuitBreaker:${breaker.name}] Fallback executed:`, result);
  });

  breaker.on('timeout', () => {
    console.error(`⏱️ [CircuitBreaker:${breaker.name}] Call timed out.`);
  });

  breaker.on('reject', () => {
    console.warn(`⛔ [CircuitBreaker:${breaker.name}] Request rejected because circuit is OPEN.`);
  });

  return breaker;
}
