export const queuePerformancePolicy = Object.freeze({
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
});
