import { describe, expect, it } from 'vitest';
import path from 'path';

describe('PM2 Ecosystem Configuration (ecosystem.config.cjs)', () => {
  const configPath = path.resolve(__dirname, '../../ecosystem.config.cjs');
  const config = require(configPath);

  it('exports an apps array containing hostelghar-api', () => {
    expect(config).toBeDefined();
    expect(Array.isArray(config.apps)).toBe(true);
    expect(config.apps).toHaveLength(1);

    const app = config.apps[0];
    expect(app.name).toBe('hostelghar-api');
  });

  it('uses compiled entrypoint and preserves observability preloads', () => {
    const app = config.apps[0];
    expect(app.script).toBe('dist/index.js');
    expect(app.node_args).toEqual(
      expect.arrayContaining([
        '-r',
        'dotenv/config',
        '-r',
        './dist/observability/tracing/instrumentation.js',
      ]),
    );
  });

  it('enforces single fork mode and conservative resource limits for cPanel/CloudLinux', () => {
    const app = config.apps[0];
    expect(app.exec_mode).toBe('fork');
    expect(app.instances).toBe(1);
    expect(app.watch).toBe(false);
    expect(app.autorestart).toBe(true);
    expect(app.max_memory_restart).toBe('350M');
    expect(app.max_restarts).toBe(10);
    expect(app.min_uptime).toBe('10s');
    expect(app.kill_timeout).toBe(8000);
  });

  it('configures distinct timestamped logs and production environments', () => {
    const app = config.apps[0];
    expect(app.out_file).toBe('./logs/pm2-out.log');
    expect(app.error_file).toBe('./logs/pm2-error.log');
    expect(app.merge_logs).toBe(false);
    expect(typeof app.log_date_format).toBe('string');
    expect(app.env_production).toMatchObject({
      NODE_ENV: 'production',
      PORT: 8000,
      ENABLE_WORKERS: 'true',
    });
  });
});
