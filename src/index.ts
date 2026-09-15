// ──────────────────────────────────────────────────────────────────────────────
// FILE: index.ts (Application Entry Point)
// PURPOSE: This is the FIRST file Node.js executes. It bootstraps the entire
//          application in the correct order:
//          1. Load environment variables (done by envConfig.ts on import).
//          2. Initialize the database connection (must complete BEFORE the
//             server starts accepting requests — otherwise the first
//             requests would hit a non-connected database and crash).
//          3. Create the Express app with all middleware and routes.
//          4. Start listening for HTTP connections on the configured port.
//
// WHY ASYNC IIFE? Node.js does not support top-level `await` in CommonJS
// modules. The IIFE (Immediately Invoked Function Expression) provides an
// async scope so we can `await` the database initialization.
// ──────────────────────────────────────────────────────────────────────────────

import http from 'http';
import { startTelemetry, shutdownTelemetry } from './observability/telemetry';
import { logger } from './observability/logger';
import { shutdownCircuitBreakers } from './utils/circuit-breaker.util';

startTelemetry();
// Import the app factory function that creates a fully-configured Express app.
import { createApp } from './configs/app';

// Import the centralized environment config to read the PORT.
import { dotEnvConfig } from './configs/envConfig';

// Import the database bootstrap function that opens the TypeORM connection.
import { bootstrapDatabase } from './database/database.boostrap';

// Import Socket.io server and BullMQ workers bootstrap
import { socketServer } from './socket/socket.server';
import { bootstrapWorkers, shutdownWorkers } from './workers/workers.boostrap';

// ─── Application Startup ───────────────────────────────────────────────────

const { PORT } = dotEnvConfig;

(async () => {
  try {
    // ── Step 1: Connect to the database ─────────────────────────────────
    await bootstrapDatabase();

    // ── Step 2: Create the Express application ──────────────────────────
    const app = createApp();

    // ── Step 3: Wrap Express app in HTTP Server for WebSockets ──────────
    const httpServer = http.createServer(app);

    // ── Step 4: Initialize Socket.io with Redis Adapter ─────────────────
    socketServer.init(httpServer);

    // ── Step 5: Bootstrap BullMQ Background Workers ─────────────────────
    bootstrapWorkers();

    // ── Step 6: Start the HTTP Server ───────────────────────────────────
    httpServer.on('error', (error) => {
      logger.fatal('HTTP server failed', {
        error: error instanceof Error ? error.message : String(error),
        code: (error as NodeJS.ErrnoException).code,
        port: PORT,
      });
      process.exitCode = 1;
    });

    httpServer.listen(PORT, () => {
      logger.info('HTTP server started', {
        port: PORT,
        cors_origin: dotEnvConfig.CORS_ORIGIN,
      });
    });

    // ── Graceful Shutdown Handling ─────────────────────────────────────
    const handleShutdown = async (signal: string) => {
      logger.info('Starting graceful shutdown', { signal });
      await shutdownWorkers();
      shutdownCircuitBreakers();
      httpServer.close(() => {
        void shutdownTelemetry();
        logger.info('HTTP and WebSocket server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('SIGINT', () => handleShutdown('SIGINT'));
  } catch (error) {
    logger.fatal('Failed to start application', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
})();

process.on('uncaughtException', (error) => {
  logger.fatal('Uncaught exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.fatal('Unhandled promise rejection', {
    error: reason instanceof Error ? reason.message : String(reason),
  });
  process.exit(1);
});
