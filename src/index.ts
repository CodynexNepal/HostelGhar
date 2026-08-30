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
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`📋 Health check: http://localhost:${PORT}/health`);
      console.log(`⚡ Socket.io listening for real-time connections`);
    });

    // ── Graceful Shutdown Handling ─────────────────────────────────────
    const handleShutdown = async (signal: string) => {
      console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
      await shutdownWorkers();
      httpServer.close(() => {
        console.log('HTTP & WebSocket server closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('SIGINT', () => handleShutdown('SIGINT'));
  } catch (error) {
    console.error('❌ Failed to start application:', error);
    process.exit(1);
  }
})();
