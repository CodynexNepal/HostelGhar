"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const crypto_1 = require("crypto");
const logout_service_1 = require("../../services/auth/logout.service");
const statusCode_interface_1 = require("../../constant/statusCode.interface");
const cookie_manager_util_1 = require("../../utils/cookie-manager.util");
const message_interface_1 = require("../../constant/message.interface");
const logger_1 = require("../../observability/logger");
class AuthController {
    constructor(authService) {
        this.authService = authService;
        this.register = async (req, res, next) => {
            try {
                const result = await this.authService.register(req.body);
                cookie_manager_util_1.CookieManager.setAuthCookies(res, result.accessToken, result.refreshToken);
                res.status(statusCode_interface_1.STATUS_CODE.CREATED).json({
                    success: true,
                    message: message_interface_1.MESSAGES.USER_CREATED_SUCCESS,
                    data: {
                        user: result.user,
                        token: result.accessToken,
                        accessToken: result.accessToken,
                    },
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.login = async (req, res, next) => {
            try {
                const result = await this.authService.Login(req.body);
                cookie_manager_util_1.CookieManager.setAuthCookies(res, result.accessToken, result.refreshToken);
                res.status(statusCode_interface_1.STATUS_CODE.SUCCESS).json({
                    success: true,
                    message: message_interface_1.MESSAGES.LOGIN_SUCCESS,
                    data: {
                        user: result.user,
                        token: result.accessToken,
                        accessToken: result.accessToken,
                    },
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.forgotPassword = async (req, res, next) => {
            try {
                const correlationId = req.headers['x-request-id'] ||
                    res.getHeader('x-request-id') ||
                    (0, crypto_1.randomUUID)();
                const emailStr = typeof req.body?.email === 'string' ? req.body.email : '';
                const recipientDomain = emailStr.split('@')[1] || 'unknown';
                logger_1.logger.info('Password reset request received', {
                    status: 'REQUEST_RECEIVED',
                    correlationId,
                    recipientDomain,
                });
                await this.authService.forgotPassword(req.body, correlationId);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({ message: message_interface_1.MESSAGES.RESET_EMAIL_SENT });
            }
            catch (error) {
                next(error);
            }
        };
        this.resetPassword = async (req, res, next) => {
            try {
                await this.authService.resetPassword(req.body);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({ message: message_interface_1.MESSAGES.PASSWORD_RESET_SUCCESS });
            }
            catch (error) {
                next(error);
            }
        };
        this.changePassword = async (req, res, next) => {
            try {
                await this.authService.changePassword(req.user.userId, req.body);
                cookie_manager_util_1.CookieManager.clearAuthCookies(res);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({ message: message_interface_1.MESSAGES.PASSWORD_RESET_SUCCESS });
            }
            catch (error) {
                next(error);
            }
        };
        /**
         * GET /auth/me — returns the logged-in user's profile (id/email/role).
         * Frontend calls this on boot + right after login to decide which
         * dashboard to redirect to. Requires a valid access token
         * (Authorization: Bearer <token> OR access_token cookie).
         */
        this.me = async (req, res, next) => {
            try {
                const user = await this.authService.getMe(req.user.userId);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({ success: true, data: { user } });
            }
            catch (error) {
                next(error);
            }
        };
        this.refresh = async (req, res, next) => {
            try {
                const rawToken = req.cookies?.[cookie_manager_util_1.CookieManager.REFRESH_TOKEN_COOKIE] ?? req.body?.refreshToken;
                if (!rawToken) {
                    res.status(statusCode_interface_1.STATUS_CODE.UNAUTHORIZED).json({
                        success: false,
                        message: message_interface_1.MESSAGES.SESSION_INVALID,
                    });
                    return;
                }
                const result = await this.authService.refresh(rawToken);
                cookie_manager_util_1.CookieManager.setAuthCookies(res, result.accessToken, result.refreshToken);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    message: message_interface_1.MESSAGES.SUCCESS,
                    data: { user: result.user },
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.logout = async (req, res, next) => {
            try {
                const header = req.headers.authorization;
                const bearer = header && header.startsWith('Bearer ') ? header.split(' ')[1] : undefined;
                const bodyAll = req.body?.logoutAll === true;
                const queryAll = req.query?.logoutAll === 'true' || req.query?.all === 'true';
                const result = await logout_service_1.logoutService.logout({
                    userId: req.user?.userId,
                    accessToken: bearer ?? req.cookies?.[cookie_manager_util_1.CookieManager.ACCESS_TOKEN_COOKIE],
                    refreshToken: req.cookies?.[cookie_manager_util_1.CookieManager.REFRESH_TOKEN_COOKIE] ?? req.body?.refreshToken,
                    logoutAll: bodyAll || queryAll,
                });
                try {
                    if (result.userId)
                        await this.authService.logout(result.userId);
                    else if (req.user?.userId)
                        await this.authService.logout(req.user.userId);
                }
                catch {
                    // Best effort: token/cache/socket teardown above already succeeded.
                }
                cookie_manager_util_1.CookieManager.clearAuthCookies(res);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    message: result.logoutAll ? message_interface_1.MESSAGES.SESSIONS_REVOKED : message_interface_1.MESSAGES.LOGOUT_SUCCESS,
                    data: {
                        devicesRevoked: result.devicesRevoked,
                        cacheKeysPurged: result.cacheKeysPurged,
                    },
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.logoutAll = async (req, res, next) => {
            try {
                const header = req.headers.authorization;
                const bearer = header && header.startsWith('Bearer ') ? header.split(' ')[1] : undefined;
                const result = await logout_service_1.logoutService.logout({
                    userId: req.user?.userId,
                    accessToken: bearer ?? req.cookies?.[cookie_manager_util_1.CookieManager.ACCESS_TOKEN_COOKIE],
                    refreshToken: req.cookies?.[cookie_manager_util_1.CookieManager.REFRESH_TOKEN_COOKIE] ?? req.body?.refreshToken,
                    logoutAll: true,
                });
                try {
                    if (result.userId)
                        await this.authService.logout(result.userId);
                }
                catch {
                    // Best effort.
                }
                cookie_manager_util_1.CookieManager.clearAuthCookies(res);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    message: message_interface_1.MESSAGES.SESSIONS_REVOKED,
                    data: {
                        devicesRevoked: result.devicesRevoked,
                        cacheKeysPurged: result.cacheKeysPurged,
                    },
                });
            }
            catch (error) {
                next(error);
            }
        };
    }
}
exports.AuthController = AuthController;
