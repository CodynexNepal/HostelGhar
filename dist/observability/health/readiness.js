"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readinessHandler = void 0;
const database_source_1 = require("../../database/database-source");
const redis_config_1 = require("../../configs/redis.config");
const email_sender_service_1 = require("../../services/email/email-sender.service");
const database_metrics_1 = require("../metrics/database.metrics");
const checkRedis = async () => {
    const startedAt = process.hrtime.bigint();
    try {
        if (redis_config_1.redisClient.status !== 'ready')
            return { ok: false, latencySeconds: 0 };
        await redis_config_1.redisClient.ping();
        return { ok: true, latencySeconds: Number(process.hrtime.bigint() - startedAt) / 1e9 };
    }
    catch {
        return { ok: false, latencySeconds: Number(process.hrtime.bigint() - startedAt) / 1e9 };
    }
};
const readinessHandler = async (_req, res) => {
    const databaseStartedAt = process.hrtime.bigint();
    let postgres = false;
    try {
        if (database_source_1.AppDataSource.isInitialized) {
            await database_source_1.AppDataSource.query('SELECT 1');
            postgres = true;
        }
    }
    catch {
        postgres = false;
    }
    const databaseLatencySeconds = Number(process.hrtime.bigint() - databaseStartedAt) / 1e9;
    const redis = await checkRedis();
    const smtp = await email_sender_service_1.emailSenderService.verifyConnection();
    database_metrics_1.databaseReady.set(postgres ? 1 : 0);
    database_metrics_1.databaseCheckDuration.set(databaseLatencySeconds);
    database_metrics_1.redisReady.set(redis.ok ? 1 : 0);
    database_metrics_1.redisCheckDuration.set(redis.latencySeconds);
    // In shared hosting with blocked Redis port, app operates reliably with direct DB and direct SMTP fallback
    const ready = postgres;
    res.status(ready ? 200 : 503).json({
        status: ready ? 'ok' : 'not_ready',
        dependencies: {
            postgres: postgres ? 'up' : 'down',
            redis: redis.ok ? 'up' : 'down',
            smtp: smtp.ok
                ? 'up'
                : { status: 'down', host: smtp.host, port: smtp.port, error: smtp.error },
        },
    });
};
exports.readinessHandler = readinessHandler;
