"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const telemetry_1 = require("./observability/telemetry");
const logger_1 = require("./observability/logger");
const circuit_breaker_util_1 = require("./utils/circuit-breaker.util");
(0, telemetry_1.startTelemetry)();
// Import the app factory function that creates a fully-configured Express app.
const app_1 = require("./configs/app");
// Import the centralized environment config to read the PORT.
const envConfig_1 = require("./configs/envConfig");
// Import the database bootstrap function that opens the TypeORM connection.
const database_boostrap_1 = require("./database/database.boostrap");
// Import Socket.io server and BullMQ workers bootstrap
const socket_server_1 = require("./socket/socket.server");
const workers_boostrap_1 = require("./workers/workers.boostrap");
// ─── Application Startup ───────────────────────────────────────────────────
const { PORT } = envConfig_1.dotEnvConfig;
(async () => {
    try {
        // ── Step 1: Connect to the database ─────────────────────────────────
        await (0, database_boostrap_1.bootstrapDatabase)();
        // ── Step 2: Create the Express application ──────────────────────────
        const app = (0, app_1.createApp)();
        // ── Step 3: Wrap Express app in HTTP Server for WebSockets ──────────
        const httpServer = http_1.default.createServer(app);
        // ── Step 4: Initialize Socket.io with Redis Adapter ─────────────────
        socket_server_1.socketServer.init(httpServer);
        // ── Step 5: Bootstrap BullMQ Background Workers ─────────────────────
        // On cPanel with Phusion Passenger, background workers must NOT be spawned
        // in every HTTP request worker process, otherwise multiple Passenger workers
        // create connection storms to Redis and exhaust CloudLinux LVE resources.
        const isPassenger = typeof global.PhusionPassenger !== 'undefined' ||
            process.env.PASSENGER_MODE === 'true';
        // In Passenger mode on shared hosting, background workers should only run if explicitly
        // enabled (ENABLE_WORKERS=true) to avoid connection storms across multi-process pools.
        const shouldBootstrapWorkers = envConfig_1.dotEnvConfig.ENABLE_REDIS &&
            (process.env.ENABLE_WORKERS === 'true' ||
                (!isPassenger && process.env.ENABLE_WORKERS !== 'false'));
        if (shouldBootstrapWorkers) {
            try {
                (0, workers_boostrap_1.bootstrapWorkers)();
            }
            catch (workerErr) {
                logger_1.logger.error('Failed to bootstrap BullMQ workers', {
                    error: workerErr?.message || String(workerErr),
                });
            }
        }
        // ── Step 6: Start the HTTP Server ───────────────────────────────────
        httpServer.on('error', (error) => {
            logger_1.logger.fatal('HTTP server failed', {
                error: error instanceof Error ? error.message : String(error),
                code: error.code,
                port: PORT,
            });
            process.exitCode = 1;
        });
        if (isPassenger) {
            httpServer.listen('passenger', () => {
                logger_1.logger.info('HTTP server started with Phusion Passenger', {
                    cors_origin: envConfig_1.dotEnvConfig.CORS_ORIGIN,
                });
            });
        }
        else {
            httpServer.listen(PORT, () => {
                logger_1.logger.info('HTTP server started', {
                    port: PORT,
                    cors_origin: envConfig_1.dotEnvConfig.CORS_ORIGIN,
                });
            });
        }
        // ── Graceful Shutdown Handling ─────────────────────────────────────
        let shuttingDown = false;
        const handleShutdown = async (signal) => {
            if (shuttingDown)
                return;
            shuttingDown = true;
            logger_1.logger.info('Starting graceful shutdown', { signal });
            try {
                await (0, workers_boostrap_1.shutdownWorkers)();
            }
            catch (err) {
                logger_1.logger.error('Error shutting down workers', {
                    error: err instanceof Error ? err.message : String(err),
                });
            }
            try {
                await socket_server_1.socketServer.close();
            }
            catch (err) {
                logger_1.logger.error('Error closing socket server', {
                    error: err instanceof Error ? err.message : String(err),
                });
            }
            (0, circuit_breaker_util_1.shutdownCircuitBreakers)();
            try {
                const { closeAllRedisConnections } = await Promise.resolve().then(() => __importStar(require('./configs/redis.config')));
                await closeAllRedisConnections();
            }
            catch (err) {
                logger_1.logger.error('Error closing Redis connections', {
                    error: err instanceof Error ? err.message : String(err),
                });
            }
            try {
                const { AppDataSource } = await Promise.resolve().then(() => __importStar(require('./database/database-source')));
                if (AppDataSource.isInitialized) {
                    await AppDataSource.destroy();
                    logger_1.logger.info('Database connection closed');
                }
            }
            catch (err) {
                logger_1.logger.error('Error closing database connection', {
                    error: err instanceof Error ? err.message : String(err),
                });
            }
            httpServer.close(() => {
                void (0, telemetry_1.shutdownTelemetry)();
                logger_1.logger.info('HTTP and WebSocket server closed');
                process.exit(0);
            });
            // Failsafe: force-exit before PM2 kill_timeout (8000ms) if something hangs
            setTimeout(() => process.exit(0), 7000).unref();
        };
        process.on('SIGTERM', () => void handleShutdown('SIGTERM'));
        process.on('SIGINT', () => void handleShutdown('SIGINT'));
        // Nodemon restarts with SIGUSR2 — without this, old Redis sockets stay
        // open on the server and each restart leaks clients until max-clients.
        // Re-kill self after cleanup so nodemon actually restarts the process.
        process.on('SIGUSR2', () => {
            void handleShutdown('SIGUSR2').finally(() => {
                process.kill(process.pid, 'SIGUSR2');
            });
        });
    }
    catch (error) {
        logger_1.logger.fatal('Failed to start application', {
            error: error instanceof Error ? error.message : String(error),
        });
        process.exit(1);
    }
})();
process.on('uncaughtException', (error) => {
    logger_1.logger.fatal('Uncaught exception', { error: error.message, stack: error.stack });
    process.exit(1);
});
process.on('unhandledRejection', (reason) => {
    logger_1.logger.fatal('Unhandled promise rejection', {
        error: reason instanceof Error ? reason.message : String(reason),
    });
    process.exit(1);
});
