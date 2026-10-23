import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['./tests/setup.ts'],
    passWithNoTests: true,
    // Integration suites boot the full createApp() composition root. Vitest
    // isolates FILES in separate workers by default, but heavy suites share
    // the machine with unit tests — give boots room and run files in one
    // worker per project to avoid port/singleton races.
    hookTimeout: 30000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
