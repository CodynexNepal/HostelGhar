import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
});
const requests = Number(process.env.BENCHMARK_REQUESTS || 100);
const durations = [];

try {
  for (let index = 0; index < requests; index += 1) {
    const startedAt = performance.now();
    await redis.ping();
    durations.push(performance.now() - startedAt);
  }
  durations.sort((left, right) => left - right);
  const percentile = (value) =>
    durations[Math.min(Math.ceil(requests * value) - 1, durations.length - 1)];
  console.log(
    JSON.stringify(
      {
        command: 'PING',
        requests,
        p50_ms: percentile(0.5),
        p95_ms: percentile(0.95),
        p99_ms: percentile(0.99),
      },
      null,
      2,
    ),
  );
} finally {
  redis.disconnect();
}
