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

// Import the app factory function that creates a fully-configured Express app.
import { createApp } from './configs/app';

// Import the centralized environment config to read the PORT.
import { dotEnvConfig } from './configs/envConfig';

// Import the database bootstrap function that opens the TypeORM connection.
import { bootstrapDatabase } from './database/database.boostrap';

// ─── Application Startup ───────────────────────────────────────────────────

// Destructure the PORT from env config. If PORT is not defined in .env,
// it will be `undefined` — Express will default to a random port.
const { PORT } = dotEnvConfig;

// Wrap startup in an async IIFE because we need to `await` the database
// connection before starting the HTTP server. If the database fails to
// connect, `bootstrapDatabase()` calls `process.exit(1)` — the server
// never starts, which is the desired behavior (fail fast).
(async () => {
  // ── Step 1: Connect to the database ─────────────────────────────────

  // This MUST complete before the server starts. If we started the server
  // first, incoming requests would try to query a non-initialized
  // DataSource and throw "DataSource is not initialized" errors.
  await bootstrapDatabase();

  // ── Step 2: Create the Express application ──────────────────────────

  // `createApp()` assembles the Express app with all middleware
  // (helmet, cors, cookie-parser, json parser) and mounts all routes.
  const server = createApp();

  // ── Step 3: Start the HTTP server ───────────────────────────────────

  // `server.listen()` binds the app to the specified port and starts
  // accepting incoming TCP connections. The callback fires once the
  // port is successfully bound — at this point the server is ready.
  server.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`📋 Health check: http://localhost:${PORT}/health`);
  });
})();
