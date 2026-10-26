/**
 * ──────────────────────────────────────────────────────────────────────────────
 * FILE: ecosystem.config.cjs
 * PURPOSE: Production PM2 Process Manager Configuration for Hostel Ghar API
 *          Optimized for cPanel / CloudLinux constrained hosting environments.
 * ──────────────────────────────────────────────────────────────────────────────
 */

module.exports = {
  apps: [
    {
      name: 'hostelghar-api',
      script: 'dist/index.js',
      cwd: './',

      // Preload dotenv configuration and OpenTelemetry instrumentation
      // in exact alignment with the production runtime requirement.
      node_args: ['-r', 'dotenv/config', '-r', './dist/observability/tracing/instrumentation.js'],

      // Standalone single-instance fork mode for resource-constrained hosting.
      // Avoids multi-instance cluster overhead and port/worker conflicts on CloudLinux LVE.
      exec_mode: 'fork',
      instances: 1,

      // Automatic restart & stability policies
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 2000,
      exp_backoff_restart_delay: 100,

      // Graceful shutdown & timeout constraints (Node shutdown failsafe is 7000ms)
      kill_timeout: 8000,
      listen_timeout: 10000,

      // Memory threshold: restart cleanly if memory exceeds 350MB
      // to avoid triggering CloudLinux LVE kernel out-of-memory kills (508 Insufficient Resource)
      max_memory_restart: '350M',

      // Structured timestamped logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      out_file: './logs/pm2-out.log',
      error_file: './logs/pm2-error.log',
      merge_logs: false,

      // Environment definitions (secrets must come from .env / cPanel environment)
      env_production: {
        NODE_ENV: 'production',
        PORT: 8000,
        ENABLE_WORKERS: 'true',
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 8000,
        ENABLE_WORKERS: 'true',
      },
    },
  ],
};
