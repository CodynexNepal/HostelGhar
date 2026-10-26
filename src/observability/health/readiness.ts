import { Request, Response } from 'express';
import { AppDataSource } from '../../database/database-source';
import { redisClient } from '../../configs/redis.config';
import { emailSenderService } from '../../services/email/email-sender.service';
import {
  databaseCheckDuration,
  databaseReady,
  redisCheckDuration,
  redisReady,
} from '../metrics/database.metrics';

const checkRedis = async (): Promise<{ ok: boolean; latencySeconds: number }> => {
  const startedAt = process.hrtime.bigint();
  try {
    if (redisClient.status !== 'ready') return { ok: false, latencySeconds: 0 };
    await redisClient.ping();
    return { ok: true, latencySeconds: Number(process.hrtime.bigint() - startedAt) / 1e9 };
  } catch {
    return { ok: false, latencySeconds: Number(process.hrtime.bigint() - startedAt) / 1e9 };
  }
};

export const readinessHandler = async (_req: Request, res: Response): Promise<void> => {
  const databaseStartedAt = process.hrtime.bigint();
  let postgres = false;
  try {
    if (AppDataSource.isInitialized) {
      await AppDataSource.query('SELECT 1');
      postgres = true;
    }
  } catch {
    postgres = false;
  }
  const databaseLatencySeconds = Number(process.hrtime.bigint() - databaseStartedAt) / 1e9;
  const redis = await checkRedis();
  const smtp = await emailSenderService.verifyConnection();

  databaseReady.set(postgres ? 1 : 0);
  databaseCheckDuration.set(databaseLatencySeconds);
  redisReady.set(redis.ok ? 1 : 0);
  redisCheckDuration.set(redis.latencySeconds);

  // In shared hosting with blocked Redis port, app operates reliably with direct DB and direct SMTP fallback
  const ready = postgres;
  res.status(ready ? 200 : 503).json({
    status: ready ? 'ok' : 'not_ready',
    dependencies: {
      postgres: postgres ? 'up' : 'down',
      redis: redis.ok ? 'up' : 'down',
      smtp: smtp.ok ? 'up' : { status: 'down', host: smtp.host, port: smtp.port, error: smtp.error },
    },
  });
};
