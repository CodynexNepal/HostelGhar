// FILE: logout.service.ts — production logout orchestration.
import jwt from 'jsonwebtoken';
import { dotEnvConfig } from '../../configs/envConfig';
import { cacheService } from '../../utils/cache.util';
import { socketServer } from '../../socket/socket.server';
import { UserRepository } from '../../repository/auth/user.repository';
import {
  blocklistToken,
  getTokenRemainingTtl,
  markUserLoggedOutAll,
  parseExpiryToSeconds,
} from '../../utils/token-blocklist.util';

export interface LogoutInput {
  userId?: string | undefined;
  accessToken?: string | undefined;
  refreshToken?: string | undefined;
  logoutAll?: boolean;
}

export interface LogoutResult {
  userId?: string | undefined;
  logoutAll: boolean;
  devicesRevoked: 'current' | 'all';
  accessTokenRevoked: boolean;
  refreshTokenRevoked: boolean;
  cacheKeysPurged: number;
  socketsNotified: boolean;
}

const accessTtl = (t?: string): number =>
  t ? getTokenRemainingTtl(t, parseExpiryToSeconds(dotEnvConfig.ACCESS_TOKEN_EXPIRY, 900)) : 0;

const refreshTtl = (t?: string): number =>
  t ? getTokenRemainingTtl(t, parseExpiryToSeconds(dotEnvConfig.REFRESH_TOKEN_EXPIRY, 604800)) : 0;

const resolveUserId = (uid: string | undefined, a?: string, r?: string): string | undefined => {
  if (uid) return uid;
  for (const t of [a, r]) {
    if (!t) continue;
    try {
      const d = jwt.decode(t) as { userId?: string } | null;
      if (d?.userId) return d.userId;
    } catch {
      continue;
    }
  }
  return undefined;
};

class LogoutService {
  public async logout(input: LogoutInput): Promise<LogoutResult> {
    const userId = resolveUserId(input.userId, input.accessToken, input.refreshToken);
    const logoutAll = input.logoutAll === true;
    const out: LogoutResult = {
      userId,
      logoutAll,
      devicesRevoked: logoutAll ? 'all' : 'current',
      accessTokenRevoked: false,
      refreshTokenRevoked: false,
      cacheKeysPurged: 0,
      socketsNotified: false,
    };
    const tasks: Promise<unknown>[] = [];
    if (logoutAll && userId) {
      out.refreshTokenRevoked = true;
      tasks.push(
        (async () => {
          try {
            await new UserRepository().updateRefreshToken(userId, null);
          } catch (e: any) {
            console.warn(`[Logout] DB revoke failed: ${e?.message ?? e}`);
          }
        })(),
      );
      tasks.push(
        markUserLoggedOutAll(
          userId,
          parseExpiryToSeconds(dotEnvConfig.REFRESH_TOKEN_EXPIRY, 604800),
        ),
      );
      if (input.accessToken) {
        const ttl = accessTtl(input.accessToken);
        if (ttl > 0)
          tasks.push(
            blocklistToken(input.accessToken, ttl).then((ok) => (out.accessTokenRevoked = ok)),
          );
        else out.accessTokenRevoked = true;
      } else out.accessTokenRevoked = true;
    } else {
      if (input.accessToken) {
        const ttl = accessTtl(input.accessToken);
        if (ttl > 0)
          tasks.push(
            blocklistToken(input.accessToken, ttl).then((ok) => (out.accessTokenRevoked = ok)),
          );
        else out.accessTokenRevoked = true;
      }
      if (input.refreshToken) {
        const ttl = refreshTtl(input.refreshToken);
        if (ttl > 0)
          tasks.push(
            blocklistToken(input.refreshToken, ttl).then((ok) => (out.refreshTokenRevoked = ok)),
          );
        else out.refreshTokenRevoked = true;
      }
      if (userId && input.refreshToken) {
        out.refreshTokenRevoked = true;
        const rt = input.refreshToken;
        tasks.push(
          (async () => {
            try {
              const p = jwt.decode(rt) as { userId?: string } | null;
              if (!p?.userId || p.userId !== userId) return;
              await new UserRepository().updateRefreshToken(userId, null);
            } catch (e: any) {
              console.warn(`[Logout] DB revoke failed: ${e?.message ?? e}`);
            }
          })(),
        );
      }
    }
    if (userId) {
      tasks.push(
        (async () => {
          try {
            out.cacheKeysPurged += await cacheService.invalidateContaining(userId);
          } catch (e: any) {
            console.warn(`[Logout] cache purge failed: ${e?.message ?? e}`);
          }
        })(),
      );
      for (const p of ['me:', 'session:', `user:${userId}`]) {
        tasks.push(cacheService.invalidatePattern(p).catch(() => undefined));
      }
      tasks.push(
        (async () => {
          try {
            socketServer.toUser(userId, 'auth:logged_out', {
              reason: logoutAll ? 'logout_all' : 'logout',
              at: new Date().toISOString(),
            });
            out.socketsNotified = true;
          } catch {
            out.socketsNotified = false;
          }
          try {
            await socketServer.disconnectUser(userId);
          } catch {
            /* not initialised */
          }
        })(),
      );
    }
    await Promise.allSettled(tasks);
    return out;
  }
}

export const logoutService = new LogoutService();
