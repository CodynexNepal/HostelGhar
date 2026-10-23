// FILE: token-blocklist.util.ts
// PURPOSE: Redis-backed revocation for stateless JWTs.
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { redisClient } from '../configs/redis.config';

const BLOCKLIST_PREFIX = 'auth:blocklist:';
const REVOKED_BEFORE_PREFIX = 'auth:revoked-before:';

export const hashToken = (t: string): string => crypto.createHash('sha256').update(t).digest('hex');

const bKey = (h: string): string => `${BLOCKLIST_PREFIX}${h}`;
const rKey = (u: string): string => `${REVOKED_BEFORE_PREFIX}${u}`;

export const parseExpiryToSeconds = (raw: string | undefined, fb: number): number => {
  if (!raw || typeof raw !== 'string') return fb;
  const t = raw.trim().toLowerCase();
  const n = Number(t);
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  const m = /^(\d+)\s*([smhd])$/.exec(t);
  if (!m) return fb;
  const mult: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  const unit = m[2] as string;
  return Number(m[1]) * (mult[unit] ?? 1);
};
export const getTokenRemainingTtl = (token: string, fb: number): number => {
  try {
    const d = jwt.decode(token) as { exp?: number } | null;
    if (!d || typeof d.exp !== 'number') return fb;
    const r = d.exp - Math.floor(Date.now() / 1000);
    return r > 0 ? r : 0;
  } catch {
    return fb;
  }
};

export const getTokenIssuedAtMs = (token: string): number => {
  try {
    const d = jwt.decode(token) as { iat?: number } | null;
    if (!d || typeof d.iat !== 'number') return 0;
    return d.iat * 1000;
  } catch {
    return 0;
  }
};

export const blocklistToken = async (token: string, ttl: number): Promise<boolean> => {
  try {
    if (!token || ttl <= 0) return false;
    if (redisClient.status !== 'ready') return false;
    await redisClient.set(bKey(hashToken(token)), '1', 'EX', Math.ceil(ttl));
    return true;
  } catch (e: any) {
    console.warn(`[AuthBlocklist] write failed: ${e?.message ?? e}`);
    return false;
  }
};

export const isTokenBlocklisted = async (token: string): Promise<boolean> => {
  try {
    if (!token) return false;
    if (redisClient.status !== 'ready') return false;
    return (await redisClient.get(bKey(hashToken(token)))) === '1';
  } catch (e: any) {
    console.warn(`[AuthBlocklist] read failed (fail-open): ${e?.message ?? e}`);
    return false;
  }
};

export const markUserLoggedOutAll = async (userId: string, ttl: number): Promise<void> => {
  try {
    if (!userId) return;
    if (redisClient.status !== 'ready') return;
    await redisClient.set(rKey(userId), String(Date.now()), 'EX', Math.ceil(ttl));
  } catch (e: any) {
    console.warn(`[AuthBlocklist] logout-all failed: ${e?.message ?? e}`);
  }
};

export const getUserRevokedBefore = async (userId: string): Promise<number> => {
  try {
    if (!userId) return 0;
    if (redisClient.status !== 'ready') return 0;
    const v = Number(await redisClient.get(rKey(userId)));
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch (e: any) {
    console.warn(`[AuthBlocklist] revoked read failed (fail-open): ${e?.message ?? e}`);
    return 0;
  }
};

export const isRevokedByLogoutAll = async (userId: string, iatMs: number): Promise<boolean> => {
  if (!userId || !iatMs) return false;
  const before = await getUserRevokedBefore(userId);
  return before > 0 && iatMs < before;
};
