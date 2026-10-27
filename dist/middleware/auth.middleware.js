"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: auth.middleware.ts
// PURPOSE: JWT verification & RBAC authorization middleware.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRoles = exports.optionalAuthenticate = exports.authenticate = void 0;
const jwt_token_util_1 = require("../utils/jwt-token.util");
const statusCode_interface_1 = require("../constant/statusCode.interface");
const token_blocklist_util_1 = require("../utils/token-blocklist.util");
const cors_config_1 = require("../configs/cors.config");
/**
 * Authenticates JWT token from Authorization header or cookies
 */
const authenticate = async (req, res, next) => {
    // If already authenticated earlier in the middleware pipeline for this request,
    // skip duplicate token verification, hashing, and Redis queries.
    if (req.user) {
        next();
        return;
    }
    const authHeader = req.headers.authorization;
    let token;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    }
    else if (req.cookies?.access_token) {
        token = req.cookies.access_token;
    }
    if (!token) {
        (0, cors_config_1.applyCorsHeaders)(req, res);
        res.status(statusCode_interface_1.STATUS_CODE.UNAUTHORIZED).json({
            success: false,
            message: 'Authentication required. Please provide a valid token.',
        });
        return;
    }
    const payload = jwt_token_util_1.JwtTokenService.verifyAccessToken(token);
    if (!payload) {
        (0, cors_config_1.applyCorsHeaders)(req, res);
        res.status(statusCode_interface_1.STATUS_CODE.UNAUTHORIZED).json({
            success: false,
            message: 'Invalid or expired authentication token.',
        });
        return;
    }
    const user = payload;
    try {
        if (await (0, token_blocklist_util_1.isTokenBlocklisted)(token)) {
            (0, cors_config_1.applyCorsHeaders)(req, res);
            res.status(statusCode_interface_1.STATUS_CODE.UNAUTHORIZED).json({
                success: false,
                message: 'Session revoked. Please sign in again.',
            });
            return;
        }
        if (user?.userId && (await (0, token_blocklist_util_1.isRevokedByLogoutAll)(user.userId, (0, token_blocklist_util_1.getTokenIssuedAtMs)(token)))) {
            (0, cors_config_1.applyCorsHeaders)(req, res);
            res.status(statusCode_interface_1.STATUS_CODE.UNAUTHORIZED).json({
                success: false,
                message: 'Session revoked. Please sign in again.',
            });
            return;
        }
    }
    catch {
        // Fail open is handled inside the blocklist helpers; continue.
    }
    req.user = user;
    next();
};
exports.authenticate = authenticate;
const optionalAuthenticate = async (req, _res, next) => {
    if (req.user) {
        next();
        return;
    }
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.split(' ')[1]
        : req.cookies?.access_token;
    if (token) {
        const payload = jwt_token_util_1.JwtTokenService.verifyAccessToken(token);
        if (payload)
            req.user = payload;
    }
    next();
};
exports.optionalAuthenticate = optionalAuthenticate;
/**
 * Restricts access to specific roles (RBAC)
 */
const requireRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            (0, cors_config_1.applyCorsHeaders)(req, res);
            res.status(statusCode_interface_1.STATUS_CODE.UNAUTHORIZED).json({
                success: false,
                message: 'Authentication required.',
            });
            return;
        }
        const userRole = req.user.role?.toLowerCase();
        const hasRole = allowedRoles.some((r) => r.toLowerCase() === userRole);
        if (!hasRole) {
            (0, cors_config_1.applyCorsHeaders)(req, res);
            res.status(statusCode_interface_1.STATUS_CODE.FORBIDDEN).json({
                success: false,
                message: `Forbidden. This action requires one of the following roles: [${allowedRoles.join(', ')}] (your role: ${req.user.role ?? 'unknown'})`,
            });
            return;
        }
        next();
    };
};
exports.requireRoles = requireRoles;
