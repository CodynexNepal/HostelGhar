"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const message_interface_1 = require("../../constant/message.interface");
const statusCode_interface_1 = require("../../constant/statusCode.interface");
const jwt_token_util_1 = require("../../utils/jwt-token.util");
const password_hasher_util_1 = require("../../utils/password-hasher.util");
const createHttpError_1 = require("../../utils/createHttpError");
const normalize_util_1 = require("../../utils/normalize.util");
const event_dispatcher_util_1 = require("../../utils/event-dispatcher.util");
const envConfig_1 = require("../../configs/envConfig");
const token_blocklist_util_1 = require("../../utils/token-blocklist.util");
const queue_constants_1 = require("../../constant/queue.constants");
const email_template_1 = require("../../templates/email.template");
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = require("../../observability/logger");
const toSafeUserResponse = (user) => ({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
});
class AuthService {
    constructor(userRepository) {
        this.userRepository = userRepository;
        this.Login = this.Login.bind(this);
        this.register = this.register.bind(this);
    }
    async Login(dto) {
        const user = await this.userRepository.findByEmail((0, normalize_util_1.normalizeEmail)(dto.email));
        if (!user) {
            throw (0, createHttpError_1.createHttpError)(message_interface_1.MESSAGES.INVALID_EMAIL_OR_PASSWORD, statusCode_interface_1.STATUS_CODE.UNAUTHORIZED);
        }
        const isPasswordValid = await password_hasher_util_1.PasswordHasher.compare(dto.password, user.password);
        if (!isPasswordValid) {
            throw (0, createHttpError_1.createHttpError)(message_interface_1.MESSAGES.INVALID_EMAIL_OR_PASSWORD, statusCode_interface_1.STATUS_CODE.UNAUTHORIZED);
        }
        return this.issueTokensForUser(user);
    }
    async issueTokensForUser(user) {
        const tokenPayload = {
            userId: user.id,
            email: user.email,
            role: user.role,
        };
        const accessToken = jwt_token_util_1.JwtTokenService.generateAccessToken(tokenPayload);
        const refreshToken = jwt_token_util_1.JwtTokenService.generateRefreshToken(tokenPayload);
        const hashedRefreshToken = await password_hasher_util_1.PasswordHasher.hash(refreshToken);
        await this.userRepository.updateRefreshToken(user.id, hashedRefreshToken);
        return {
            accessToken,
            refreshToken,
            user: toSafeUserResponse(user),
        };
    }
    async register(dto) {
        const email = (0, normalize_util_1.normalizeEmail)(dto.email);
        const existingUser = await this.userRepository.findByEmail(email);
        if (existingUser) {
            throw (0, createHttpError_1.createHttpError)(message_interface_1.MESSAGES.USER_ALREADY_EXISTS, statusCode_interface_1.STATUS_CODE.CONFLICT);
        }
        const hashedPassword = await password_hasher_util_1.PasswordHasher.hash(dto.password);
        const newUser = await this.userRepository.createUser({
            firstName: dto.firstName,
            lastName: dto.lastName,
            email,
            password: hashedPassword,
        });
        const welcomeTemplate = (0, email_template_1.renderWelcomeEmail)(newUser.firstName);
        // Asynchronously queue welcome email in the background without blocking registration response or timing out
        event_dispatcher_util_1.eventDispatcher
            .queueEmail(queue_constants_1.JobType.SEND_WELCOME_EMAIL, {
            to: newUser.email,
            subject: welcomeTemplate.subject,
            body: welcomeTemplate.body,
        }, { timeoutMs: 2500, fallbackToDirectSmtp: true })
            .catch((err) => {
            logger_1.logger.warn('Failed to dispatch welcome email during user registration', {
                userId: newUser.id,
                error: err?.message || String(err),
            });
        });
        return this.issueTokensForUser(newUser);
    }
    async forgotPassword(dto, correlationId) {
        const user = await this.userRepository.findByEmail((0, normalize_util_1.normalizeEmail)(dto.email));
        if (!user) {
            // Preserve account-enumeration protections: do not reveal whether account exists
            logger_1.logger.info('Password reset requested for non-existent or unverified account', {
                correlationId,
            });
            return;
        }
        // Idempotency guard: prevent duplicate emails and token churn if requested within 2m cooldown
        if (user.passwordResetExpiresAt) {
            const timeRemainingMs = user.passwordResetExpiresAt.getTime() - Date.now();
            if (timeRemainingMs > 13 * 60 * 1000) {
                logger_1.logger.info('Password reset request throttled within active cooldown window', {
                    correlationId,
                    userId: user.id,
                    timeRemainingMs,
                });
                return;
            }
        }
        const resetToken = crypto_1.default.randomBytes(32).toString('hex');
        const tokenHash = crypto_1.default.createHash('sha256').update(resetToken).digest('hex');
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
        await this.userRepository.setPasswordResetToken(user.id, tokenHash, expiresAt);
        logger_1.logger.info('Password reset token generated and stored safely', {
            correlationId,
            userId: user.id,
            expiresAt: expiresAt.toISOString(),
        });
        const frontendBaseUrl = process.env.FRONTEND_URL ||
            process.env.FRONTEND_ORIGIN?.split(',')[0] ||
            'https://hostelghar.com';
        const resetUrl = `${frontendBaseUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(resetToken)}`;
        const template = (0, email_template_1.renderPasswordResetEmail)(user.firstName, resetToken, resetUrl);
        try {
            await event_dispatcher_util_1.eventDispatcher.queueEmail(queue_constants_1.JobType.SEND_PASSWORD_RESET, {
                to: user.email,
                subject: template.subject,
                body: template.body,
                ...(template.html ? { html: template.html } : {}),
                context: {
                    correlationId,
                    userId: user.id,
                },
            }, { timeoutMs: 2500, fallbackToDirectSmtp: true });
        }
        catch (queueErr) {
            logger_1.logger.error('Failed to deliver password reset email', {
                correlationId,
                userId: user.id,
                error: queueErr?.message || String(queueErr),
            });
            throw (0, createHttpError_1.createHttpError)('Service temporarily unavailable. Unable to dispatch reset email. Please try again later.', statusCode_interface_1.STATUS_CODE.SERVICE_UNAVAILABLE);
        }
    }
    async resetPassword(dto) {
        const tokenHash = crypto_1.default.createHash('sha256').update(dto.token).digest('hex');
        const user = await this.userRepository.findByPasswordResetToken(tokenHash);
        if (!user ||
            !user.passwordResetExpiresAt ||
            user.passwordResetExpiresAt.getTime() < Date.now()) {
            throw (0, createHttpError_1.createHttpError)(message_interface_1.MESSAGES.RESET_TOKEN_INVALID, statusCode_interface_1.STATUS_CODE.UNAUTHORIZED);
        }
        const hashedPassword = await password_hasher_util_1.PasswordHasher.hash(dto.newPassword);
        await this.userRepository.updatePassword(user.id, hashedPassword);
        const template = (0, email_template_1.renderPasswordChangedEmail)(user.firstName);
        event_dispatcher_util_1.eventDispatcher
            .queueEmail(queue_constants_1.JobType.SEND_PASSWORD_RESET, {
            to: user.email,
            subject: template.subject,
            body: template.body,
        }, { timeoutMs: 2500, fallbackToDirectSmtp: true })
            .catch((err) => {
            logger_1.logger.warn('Failed to dispatch password changed confirmation email', {
                userId: user.id,
                error: err?.message || String(err),
            });
        });
    }
    async changePassword(userId, dto) {
        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw (0, createHttpError_1.createHttpError)(message_interface_1.MESSAGES.USER_NOT_FOUND, statusCode_interface_1.STATUS_CODE.NOT_FOUND);
        }
        const isPasswordValid = await password_hasher_util_1.PasswordHasher.compare(dto.currentPassword, user.password);
        if (!isPasswordValid) {
            throw (0, createHttpError_1.createHttpError)(message_interface_1.MESSAGES.INVALID_EMAIL_OR_PASSWORD, statusCode_interface_1.STATUS_CODE.UNAUTHORIZED);
        }
        const hashedPassword = await password_hasher_util_1.PasswordHasher.hash(dto.newPassword);
        await this.userRepository.updatePassword(user.id, hashedPassword);
        await (0, token_blocklist_util_1.markUserLoggedOutAll)(user.id, (0, token_blocklist_util_1.parseExpiryToSeconds)(envConfig_1.dotEnvConfig.REFRESH_TOKEN_EXPIRY, 604800));
        const template = (0, email_template_1.renderPasswordChangedEmail)(user.firstName);
        event_dispatcher_util_1.eventDispatcher
            .queueEmail(queue_constants_1.JobType.SEND_PASSWORD_RESET, {
            to: user.email,
            subject: template.subject,
            body: template.body,
        }, { timeoutMs: 2500, fallbackToDirectSmtp: true })
            .catch((err) => {
            logger_1.logger.warn('Failed to dispatch password changed confirmation email', {
                userId: user.id,
                error: err?.message || String(err),
            });
        });
    }
    /**
     * Returns the currently-authenticated user's public profile.
     * Used by the frontend (`GET /auth/me`) on app boot / after login
     * to learn the user's `role` and redirect to the correct dashboard
     * (admin | owner | resident | user) without a second login.
     */
    async getMe(userId) {
        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw (0, createHttpError_1.createHttpError)(message_interface_1.MESSAGES.USER_NOT_FOUND, statusCode_interface_1.STATUS_CODE.NOT_FOUND);
        }
        return toSafeUserResponse(user);
    }
    /**
     * Rotates tokens from a valid refresh token. The caller passes the raw
     * refresh token (cookie or body); we compare it against the stored
     * bcrypt hash, then issue a fresh token pair.
     */
    async refresh(refreshToken) {
        if (await (0, token_blocklist_util_1.isTokenBlocklisted)(refreshToken)) {
            throw (0, createHttpError_1.createHttpError)(message_interface_1.MESSAGES.SESSION_INVALID, statusCode_interface_1.STATUS_CODE.UNAUTHORIZED);
        }
        const payload = jwt_token_util_1.JwtTokenService.verifyRefreshToken(refreshToken);
        if (!payload?.userId) {
            throw (0, createHttpError_1.createHttpError)(message_interface_1.MESSAGES.SESSION_INVALID, statusCode_interface_1.STATUS_CODE.UNAUTHORIZED);
        }
        if (await (0, token_blocklist_util_1.isRevokedByLogoutAll)(payload.userId, (0, token_blocklist_util_1.getTokenIssuedAtMs)(refreshToken))) {
            throw (0, createHttpError_1.createHttpError)(message_interface_1.MESSAGES.SESSION_INVALID, statusCode_interface_1.STATUS_CODE.UNAUTHORIZED);
        }
        const user = await this.userRepository.findById(payload.userId);
        if (!user || !user.refreshToken) {
            throw (0, createHttpError_1.createHttpError)(message_interface_1.MESSAGES.SESSION_INVALID, statusCode_interface_1.STATUS_CODE.UNAUTHORIZED);
        }
        const matches = await password_hasher_util_1.PasswordHasher.compare(refreshToken, user.refreshToken);
        if (!matches) {
            throw (0, createHttpError_1.createHttpError)(message_interface_1.MESSAGES.SESSION_INVALID, statusCode_interface_1.STATUS_CODE.UNAUTHORIZED);
        }
        return this.issueTokensForUser(user);
    }
    async logout(userId) {
        await this.userRepository.updateRefreshToken(userId, null);
    }
}
exports.AuthService = AuthService;
