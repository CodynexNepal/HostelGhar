// ──────────────────────────────────────────────────────────────────────────────
// FILE: tests/integration/boot.ts
// PURPOSE: Single shared boot for ALL integration suites. Vitest runs test
//          FILES in parallel workers, and booting createApp() twice in the
//          same tick collides on the stubbed singletons — so every suite
//          imports this module and reuses one server per worker file.
// ──────────────────────────────────────────────────────────────────────────────
import 'reflect-metadata';
import './setup';
import type { Express } from 'express';
import { startApp, StartedApp } from '../helpers/app-harness';

let cached: StartedApp | null = null;

/** Boots createApp() once per worker and returns the shared base URL. */
export const integrationBaseUrl = async (): Promise<string> => {
  if (!cached) {
    const { createApp } = await import('../../src/configs/app');
    const app: Express = createApp();
    cached = await startApp(app);
  }
  return cached.baseUrl;
};

/** Closes the shared server (registered once per suite file). */
export const closeIntegrationApp = async (): Promise<void> => {
  if (cached) {
    await cached.close();
    cached = null;
  }
};
