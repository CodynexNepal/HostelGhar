import { monitorEventLoopDelay } from 'node:perf_hooks';

const monitor = monitorEventLoopDelay({ resolution: 20 });
monitor.enable();

const interval = setInterval(() => {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      mean_ms: Number(monitor.mean) / 1e6,
      p95_ms: Number(monitor.percentile(95)) / 1e6,
      max_ms: Number(monitor.max) / 1e6,
    }),
  );
  monitor.reset();
}, 10000);

const shutdown = () => {
  clearInterval(interval);
  monitor.disable();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
