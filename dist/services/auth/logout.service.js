"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logoutService = void 0;
// FILE: logout.service.ts — production logout orchestration.
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const envConfig_1 = require("../../configs/envConfig");
const cache_util_1 = require("../../utils/cache.util");
const socket_server_1 = require("../../socket/socket.server");
const user_repository_1 = require("../../repository/auth/user.repository");
const token_blocklist_util_1 = require("../../utils/token-blocklist.util");
const accessTtl = (t) => t ? (0, token_blocklist_util_1.getTokenRemainingTtl)(t, (0, token_blocklist_util_1.parseExpiryToSeconds)(envConfig_1.dotEnvConfig.ACCESS_TOKEN_EXPIRY, 900)) : 0;
const refreshTtl = (t) => t ? (0, token_blocklist_util_1.getTokenRemainingTtl)(t, (0, token_blocklist_util_1.parseExpiryToSeconds)(envConfig_1.dotEnvConfig.REFRESH_TOKEN_EXPIRY, 604800)) : 0;
const resolveUserId = (uid, a, r) => {
    if (uid)
        return uid;
    for (const t of [a, r]) {
        if (!t)
            continue;
        try {
            const d = jsonwebtoken_1.default.decode(t);
            if (d?.userId)
                return d.userId;
        }
        catch {
            continue;
        }
    }
    return undefined;
};
class LogoutService {
    async logout(input) {
        const userId = resolveUserId(input.userId, input.accessToken, input.refreshToken);
        const logoutAll = input.logoutAll === true;
        const out = {
            userId,
            logoutAll,
            devicesRevoked: logoutAll ? 'all' : 'current',
            accessTokenRevoked: false,
            refreshTokenRevoked: false,
            cacheKeysPurged: 0,
            socketsNotified: false,
        };
        const tasks = [];
        if (logoutAll && userId) {
            out.refreshTokenRevoked = true;
            tasks.push((async () => {
                try {
                    await new user_repository_1.UserRepository().updateRefreshToken(userId, null);
                }
                catch (e) {
                    console.warn(`[Logout] DB revoke failed: ${e?.message ?? e}`);
                }
            })());
            tasks.push((0, token_blocklist_util_1.markUserLoggedOutAll)(userId, (0, token_blocklist_util_1.parseExpiryToSeconds)(envConfig_1.dotEnvConfig.REFRESH_TOKEN_EXPIRY, 604800)));
            if (input.accessToken) {
                const ttl = accessTtl(input.accessToken);
                if (ttl > 0)
                    tasks.push((0, token_blocklist_util_1.blocklistToken)(input.accessToken, ttl).then((ok) => (out.accessTokenRevoked = ok)));
                else
                    out.accessTokenRevoked = true;
            }
            else
                out.accessTokenRevoked = true;
        }
        else {
            if (input.accessToken) {
                const ttl = accessTtl(input.accessToken);
                if (ttl > 0)
                    tasks.push((0, token_blocklist_util_1.blocklistToken)(input.accessToken, ttl).then((ok) => (out.accessTokenRevoked = ok)));
                else
                    out.accessTokenRevoked = true;
            }
            if (input.refreshToken) {
                const ttl = refreshTtl(input.refreshToken);
                if (ttl > 0)
                    tasks.push((0, token_blocklist_util_1.blocklistToken)(input.refreshToken, ttl).then((ok) => (out.refreshTokenRevoked = ok)));
                else
                    out.refreshTokenRevoked = true;
            }
            if (userId && input.refreshToken) {
                out.refreshTokenRevoked = true;
                const rt = input.refreshToken;
                tasks.push((async () => {
                    try {
                        const p = jsonwebtoken_1.default.decode(rt);
                        if (!p?.userId || p.userId !== userId)
                            return;
                        await new user_repository_1.UserRepository().updateRefreshToken(userId, null);
                    }
                    catch (e) {
                        console.warn(`[Logout] DB revoke failed: ${e?.message ?? e}`);
                    }
                })());
            }
        }
        if (userId) {
            tasks.push((async () => {
                try {
                    out.cacheKeysPurged += await cache_util_1.cacheService.invalidateContaining(userId);
                }
                catch (e) {
                    console.warn(`[Logout] cache purge failed: ${e?.message ?? e}`);
                }
            })());
            for (const p of ['me:', 'session:', `user:${userId}`]) {
                tasks.push(cache_util_1.cacheService.invalidatePattern(p).catch(() => undefined));
            }
            tasks.push((async () => {
                try {
                    socket_server_1.socketServer.toUser(userId, 'auth:logged_out', {
                        reason: logoutAll ? 'logout_all' : 'logout',
                        at: new Date().toISOString(),
                    });
                    out.socketsNotified = true;
                }
                catch {
                    out.socketsNotified = false;
                }
                try {
                    await socket_server_1.socketServer.disconnectUser(userId);
                }
                catch {
                    /* not initialised */
                }
            })());
        }
        await Promise.allSettled(tasks);
        return out;
    }
}
exports.logoutService = new LogoutService();
