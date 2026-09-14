const baseUrl = process.env.API_URL || 'http://localhost:3000';
const requests = Number(process.env.BENCHMARK_REQUESTS || 100);
const durations = [];

for (let index = 0; index < requests; index += 1) {
  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}/health/live`);
  durations.push(performance.now() - startedAt);
  if (!response.ok) {
    throw new Error(`Health request failed with status ${response.status}`);
  }
}

durations.sort((left, right) => left - right);
const percentile = (value) =>
  durations[Math.min(Math.ceil(requests * value) - 1, durations.length - 1)];
console.log(
  JSON.stringify(
    {
      endpoint: `${baseUrl}/health/live`,
      requests,
      p50_ms: percentile(0.5),
      p95_ms: percentile(0.95),
      p99_ms: percentile(0.99),
      average_ms: durations.reduce((sum, value) => sum + value, 0) / durations.length,
    },
    null,
    2,
  ),
);
