"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: circuit-breaker.util.ts
// PURPOSE: Enterprise Circuit Breaker pattern implementation using Opossum.
//          Protects downstream services (email, third-party APIs, S3/Cloudinary)
//          from cascading failures.
// ──────────────────────────────────────────────────────────────────────────────
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.shutdownCircuitBreakers = exports.getCircuitBreakerHealth = void 0;
exports.createCircuitBreaker = createCircuitBreaker;
const opossum_1 = __importDefault(require("opossum"));
const logger_1 = require("../observability/logger");
const metrics_1 = require("../observability/metrics");
const defaultOptions = {
    timeout: 5000,
    errorThresholdPercentage: 50,
    resetTimeout: 10000,
    rollingCountTimeout: 10000,
    rollingCountBuckets: 10,
    volumeThreshold: 10,
    capacity: 100,
    allowWarmUp: false,
};
const breakers = new Map();
const recordState = (breaker) => {
    const state = breaker.opened ? 'open' : breaker.halfOpen ? 'half_open' : 'closed';
    for (const possibleState of ['closed', 'open', 'half_open']) {
        metrics_1.circuitBreakerState.set({ name: breaker.name, state: possibleState }, possibleState === state ? 1 : 0);
    }
};
/**
 * Creates a Circuit Breaker around an async action.
 *
 * @param action - Async function to be protected
 * @param options - Custom breaker options
 */
function createCircuitBreaker(action, options = {}) {
    const name = options.name || action.name || 'CircuitBreaker';
    if (breakers.has(name)) {
        throw new Error(`Circuit breaker with name "${name}" is already registered.`);
    }
    const breakerOptions = {
        ...defaultOptions,
        ...options,
        name,
    };
    delete breakerOptions.fallback;
    const breaker = new opossum_1.default(action, breakerOptions);
    if (options.fallback)
        breaker.fallback(options.fallback);
    breakers.set(name, breaker);
    recordState(breaker);
    breaker.on('fire', () => metrics_1.circuitBreakerEvents.inc({ name, event: 'fire' }));
    breaker.on('success', (_result, latencyMs) => {
        metrics_1.circuitBreakerEvents.inc({ name, event: 'success' });
        metrics_1.circuitBreakerLatency.observe({ name, outcome: 'success' }, latencyMs / 1000);
    });
    breaker.on('failure', (error, latencyMs) => {
        metrics_1.circuitBreakerEvents.inc({ name, event: 'failure' });
        metrics_1.circuitBreakerLatency.observe({ name, outcome: 'failure' }, latencyMs / 1000);
        logger_1.logger.error('Circuit breaker action failed', { breaker: name, error: error.message });
    });
    breaker.on('timeout', (error) => {
        metrics_1.circuitBreakerEvents.inc({ name, event: 'timeout' });
        logger_1.logger.warn('Circuit breaker action timed out', { breaker: name, error: error.message });
    });
    breaker.on('reject', (error) => {
        metrics_1.circuitBreakerEvents.inc({ name, event: 'reject' });
        logger_1.logger.warn('Circuit breaker rejected a call', { breaker: name, error: error.message });
    });
    breaker.on('fallback', (_result, error) => {
        metrics_1.circuitBreakerEvents.inc({ name, event: 'fallback' });
        logger_1.logger.warn('Circuit breaker fallback executed', { breaker: name, error: error.message });
    });
    breaker.on('open', () => {
        metrics_1.circuitBreakerEvents.inc({ name, event: 'open' });
        recordState(breaker);
        logger_1.logger.error('Circuit breaker opened', { breaker: name });
    });
    breaker.on('halfOpen', () => {
        metrics_1.circuitBreakerEvents.inc({ name, event: 'half_open' });
        recordState(breaker);
        logger_1.logger.warn('Circuit breaker entered half-open state', { breaker: name });
    });
    breaker.on('close', () => {
        metrics_1.circuitBreakerEvents.inc({ name, event: 'close' });
        recordState(breaker);
        logger_1.logger.info('Circuit breaker closed', { breaker: name });
    });
    breaker.on('shutdown', () => {
        metrics_1.circuitBreakerEvents.inc({ name, event: 'shutdown' });
        logger_1.logger.info('Circuit breaker shut down', { breaker: name });
    });
    return breaker;
}
const getCircuitBreakerHealth = () => [...breakers.values()].map((breaker) => ({
    name: breaker.name,
    state: breaker.opened ? 'open' : breaker.halfOpen ? 'half_open' : 'closed',
    enabled: breaker.enabled,
    pendingClose: breaker.pendingClose,
    stats: breaker.stats,
}));
exports.getCircuitBreakerHealth = getCircuitBreakerHealth;
const shutdownCircuitBreakers = () => {
    for (const breaker of breakers.values())
        breaker.shutdown();
    breakers.clear();
};
exports.shutdownCircuitBreakers = shutdownCircuitBreakers;
