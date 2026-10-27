"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: jwt-token.util.ts
// PURPOSE: Centralizes all JWT (JSON Web Token) creation and verification
//          logic. JWTs are the industry standard for stateless authentication
//          in REST APIs — the server encodes user identity into a signed token
//          so it doesn't need to query the database on every request.
//
// DESIGN DECISIONS:
//   1. SEPARATE SECRETS for access and refresh tokens — if one secret leaks,
//      the other token type remains unforgeable.
//   2. SHORT access token TTL (15m) — limits the damage window if stolen.
//   3. LONG refresh token TTL (7d) — provides convenience without requiring
//      the user to re-enter credentials constantly.
//
// OOP PRINCIPLES:
//   • Encapsulation — JWT signing/verification details are hidden.
//   • Single Responsibility — this class ONLY handles JWT operations.
//   • Static utility class — no instance state, private constructor.
// ──────────────────────────────────────────────────────────────────────────────
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JwtTokenService = void 0;
// `jwt` provides `sign()` to create tokens and `verify()` to decode + validate.
// `JwtPayload` is the TypeScript interface for decoded token data.
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
// Import centralized env config to read JWT secrets and expiry values.
const envConfig_1 = require("../configs/envConfig");
const accessTokenExpiresIn = envConfig_1.dotEnvConfig.ACCESS_TOKEN_EXPIRY;
const refreshTokenExpiresIn = envConfig_1.dotEnvConfig.REFRESH_TOKEN_EXPIRY;
// ─── JwtTokenService Class ──────────────────────────────────────────────────
class JwtTokenService {
    // ─── Private Constructor ──────────────────────────────────────────────
    // Prevents instantiation — all methods are static because JWT
    // operations don't require per-instance state.
    constructor() {
        // Intentionally empty — exists only to prevent `new JwtTokenService()`.
    }
    // ─── generateAccessToken() ────────────────────────────────────────────
    // Creates a short-lived access token (default: 15 minutes).
    // This token is sent with every API request in a cookie and authorizes
    // the user to perform actions. Its short lifespan means that even if
    // it's stolen, the attacker has a very narrow window to exploit it.
    static generateAccessToken(payload) {
        // `jwt.sign()` creates a token string with three parts:
        //   header.payload.signature (Base64URL encoded, dot-separated).
        //
        // The `ACCESS_TOKEN_SECRET` is used as the HMAC key — anyone who
        // knows this secret can forge tokens, so it must be kept secure.
        //
        // `expiresIn` sets the `exp` claim in the token payload. After this
        // time, `jwt.verify()` will reject the token automatically.
        //
        // The `!` (non-null assertion) is acceptable here because the app
        // will crash at startup if these env vars are missing — we should
        // validate this in a production startup check.
        return jsonwebtoken_1.default.sign(payload, envConfig_1.dotEnvConfig.ACCESS_TOKEN_SECRET, {
            expiresIn: accessTokenExpiresIn,
        });
    }
    // ─── generateRefreshToken() ───────────────────────────────────────────
    // Creates a long-lived refresh token (default: 7 days).
    // This token is used ONLY to obtain a new access token when the old
    // one expires. It is NOT sent with regular API requests — it lives
    // in a separate cookie and is only sent to the `/refresh` endpoint.
    //
    // Uses a DIFFERENT secret than the access token — if the access token
    // secret is compromised, the attacker still cannot forge refresh tokens
    // (and vice versa). This is defense-in-depth.
    static generateRefreshToken(payload) {
        return jsonwebtoken_1.default.sign(payload, envConfig_1.dotEnvConfig.REFRESH_TOKEN_SECRET, {
            expiresIn: refreshTokenExpiresIn,
        });
    }
    // ─── verifyAccessToken() ──────────────────────────────────────────────
    // Decodes and validates an access token. Returns the decoded payload
    // if valid, or `null` if the token is expired, tampered, or malformed.
    //
    // Returning `null` instead of throwing an error simplifies the calling
    // code — the auth middleware just checks `if (!payload)` instead of
    // wrapping every call in try/catch.
    static verifyAccessToken(token) {
        try {
            // `jwt.verify()` does three things:
            // 1. Decodes the Base64URL payload.
            // 2. Recomputes the HMAC signature and compares it (tamper check).
            // 3. Checks the `exp` claim against the current time (expiry check).
            // If ANY check fails, it throws a JsonWebTokenError.
            return jsonwebtoken_1.default.verify(token, envConfig_1.dotEnvConfig.ACCESS_TOKEN_SECRET);
        }
        catch {
            // Token is invalid (expired, wrong signature, malformed).
            // Return null — the caller will respond with 401 Unauthorized.
            return null;
        }
    }
    // ─── verifyRefreshToken() ─────────────────────────────────────────────
    // Same as verifyAccessToken but uses the REFRESH_TOKEN_SECRET.
    // Used by the token-refresh endpoint to validate the refresh token
    // before issuing a new access token.
    static verifyRefreshToken(token) {
        try {
            return jsonwebtoken_1.default.verify(token, envConfig_1.dotEnvConfig.REFRESH_TOKEN_SECRET);
        }
        catch {
            // Invalid refresh token — the caller should respond with 401 and
            // force the user to re-authenticate from scratch.
            return null;
        }
    }
}
exports.JwtTokenService = JwtTokenService;
