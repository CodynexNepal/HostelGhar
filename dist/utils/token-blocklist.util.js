"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRevokedByLogoutAll = exports.getUserRevokedBefore = exports.markUserLoggedOutAll = exports.isTokenBlocklisted = exports.blocklistToken = exports.getTokenIssuedAtMs = exports.getTokenRemainingTtl = exports.parseExpiryToSeconds = exports.hashToken = void 0;
// FILE: token-blocklist.util.ts
// PURPOSE: Redis-backed revocation for stateless JWTs.
const crypto_1 = __importDefault(require("crypto"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const redis_config_1 = require("../configs/redis.config");
const BLOCKLIST_PREFIX = 'auth:blocklist:';
const REVOKED_BEFORE_PREFIX = 'auth:revoked-before:';
const hashToken = (t) => crypto_1.default.createHash('sha256').update(t).digest('hex');
exports.hashToken = hashToken;
const bKey = (h) => `${BLOCKLIST_PREFIX}${h}`;
const rKey = (u) => `${REVOKED_BEFORE_PREFIX}${u}`;
const parseExpiryToSeconds = (raw, fb) => {
    if (!raw || typeof raw !== 'string')
        return fb;
    const t = raw.trim().toLowerCase();
    const n = Number(t);
    if (Number.isFinite(n) && n > 0)
        return Math.floor(n);
    const m = /^(\d+)\s*([smhd])$/.exec(t);
    if (!m)
        return fb;
    const mult = { s: 1, m: 60, h: 3600, d: 86400 };
    const unit = m[2];
    return Number(m[1]) * (mult[unit] ?? 1);
};
exports.parseExpiryToSeconds = parseExpiryToSeconds;
const getTokenRemainingTtl = (token, fb) => {
    try {
        const d = jsonwebtoken_1.default.decode(token);
        if (!d || typeof d.exp !== 'number')
            return fb;
        const r = d.exp - Math.floor(Date.now() / 1000);
        return r > 0 ? r : 0;
    }
    catch {
        return fb;
    }
};
exports.getTokenRemainingTtl = getTokenRemainingTtl;
const getTokenIssuedAtMs = (token) => {
    try {
        const d = jsonwebtoken_1.default.decode(token);
        if (!d || typeof d.iat !== 'number')
            return 0;
        return d.iat * 1000;
    }
    catch {
        return 0;
    }
};
exports.getTokenIssuedAtMs = getTokenIssuedAtMs;
const blocklistToken = async (token, ttl) => {
    try {
        if (!token || ttl <= 0)
            return false;
        if (redis_config_1.redisClient.status !== 'ready')
            return false;
        await redis_config_1.redisClient.set(bKey((0, exports.hashToken)(token)), '1', 'EX', Math.ceil(ttl));
        return true;
    }
    catch (e) {
        console.warn(`[AuthBlocklist] write failed: ${e?.message ?? e}`);
        return false;
    }
};
exports.blocklistToken = blocklistToken;
const isTokenBlocklisted = async (token) => {
    try {
        if (!token)
            return false;
        if (redis_config_1.redisClient.status !== 'ready')
            return false;
        return (await redis_config_1.redisClient.get(bKey((0, exports.hashToken)(token)))) === '1';
    }
    catch (e) {
        console.warn(`[AuthBlocklist] read failed (fail-open): ${e?.message ?? e}`);
        return false;
    }
};
exports.isTokenBlocklisted = isTokenBlocklisted;
const markUserLoggedOutAll = async (userId, ttl) => {
    try {
        if (!userId)
            return;
        if (redis_config_1.redisClient.status !== 'ready')
            return;
        await redis_config_1.redisClient.set(rKey(userId), String(Date.now()), 'EX', Math.ceil(ttl));
    }
    catch (e) {
        console.warn(`[AuthBlocklist] logout-all failed: ${e?.message ?? e}`);
    }
};
exports.markUserLoggedOutAll = markUserLoggedOutAll;
const getUserRevokedBefore = async (userId) => {
    try {
        if (!userId)
            return 0;
        if (redis_config_1.redisClient.status !== 'ready')
            return 0;
        const v = Number(await redis_config_1.redisClient.get(rKey(userId)));
        return Number.isFinite(v) && v > 0 ? v : 0;
    }
    catch (e) {
        console.warn(`[AuthBlocklist] revoked read failed (fail-open): ${e?.message ?? e}`);
        return 0;
    }
};
exports.getUserRevokedBefore = getUserRevokedBefore;
const isRevokedByLogoutAll = async (userId, iatMs) => {
    if (!userId || !iatMs)
        return false;
    const before = await (0, exports.getUserRevokedBefore)(userId);
    return before > 0 && iatMs < before;
};
exports.isRevokedByLogoutAll = isRevokedByLogoutAll;
