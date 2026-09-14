import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX || 5),
});
const queries = Number(process.env.BENCHMARK_REQUESTS || 100);
const durations = [];

try {
  for (let index = 0; index < queries; index += 1) {
    const startedAt = performance.now();
    await pool.query('SELECT 1');
    durations.push(performance.now() - startedAt);
  }
  durations.sort((left, right) => left - right);
  const percentile = (value) =>
    durations[Math.min(Math.ceil(queries * value) - 1, durations.length - 1)];
  console.log(
    JSON.stringify(
      {
        query: 'SELECT 1',
        queries,
        p50_ms: percentile(0.5),
        p95_ms: percentile(0.95),
        p99_ms: percentile(0.99),
      },
      null,
      2,
    ),
  );
} finally {
  await pool.end();
}
