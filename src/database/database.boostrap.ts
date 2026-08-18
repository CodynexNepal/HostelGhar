// ──────────────────────────────────────────────────────────────────────────────
// FILE: database.boostrap.ts
// PURPOSE: Provides a single async function that initializes the TypeORM
//          DataSource (opens the connection pool). This function is called
//          once at application startup, BEFORE the Express server begins
//          accepting HTTP requests.
//
// WHY SEPARATE FROM database-source.ts? The DataSource object is a
// *configuration* — it describes HOW to connect. This file contains the
// *action* — it actually OPENS the connection. Separating the two means
// we can import the DataSource config in test/migration scripts without
// triggering an automatic connection.
// ──────────────────────────────────────────────────────────────────────────────

// Import the configured DataSource singleton. At this point no connection
// has been opened yet — TypeORM defers connection until `.initialize()`.
import { AppDataSource } from './database-source';

// ─── Bootstrap Function ─────────────────────────────────────────────────────

// Exported as an async function because `.initialize()` returns a Promise.
// The caller (index.ts) must `await` this before starting the HTTP server
// to guarantee that all database queries will succeed.
export const bootstrapDatabase = async (): Promise<void> => {
  try {
    // `.initialize()` opens the PostgreSQL connection pool using the
    // configuration defined in database-source.ts. If the connection fails
    // (wrong credentials, network issue), it throws — which we catch below.
    await AppDataSource.initialize();

    // Log success so operators can confirm the DB is connected in server logs.
    // In production, this could be replaced with a structured logger (winston/pino).
    console.log('✅ Database connection established successfully');
  } catch (error) {
    // Log the full error object so operators can diagnose the failure
    // (e.g., "password authentication failed", "connection refused").
    console.error('❌ Database connection failed:', error);

    // `process.exit(1)` terminates the Node process with a non-zero exit code.
    // This is intentional — there is NO point in running an API server that
    // cannot reach its database. The process manager (Docker, PM2, systemd)
    // will detect the non-zero exit and attempt a restart.
    process.exit(1);
  }
};
