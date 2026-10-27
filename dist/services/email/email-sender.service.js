"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailSenderService = exports.EmailSenderService = void 0;
const smtp_config_1 = require("../../configs/smtp.config");
const nodemailer_1 = __importDefault(require("nodemailer"));
const logger_1 = require("../../observability/logger");
class EmailSenderService {
    constructor() {
        this.primaryTransporterInstance = null;
    }
    createTransporter(host, port, secure) {
        return nodemailer_1.default.createTransport({
            host,
            port,
            secure,
            auth: smtp_config_1.smtpConfig.auth,
            tls: {
                rejectUnauthorized: false, // Ensures compatibility with cPanel/shared SSL certificates
            },
            connectionTimeout: 4000,
            greetingTimeout: 4000,
            socketTimeout: 8000,
        });
    }
    async send(payload, options) {
        if (!smtp_config_1.smtpConfig.enabled) {
            throw new Error('SMTP is not configured; owner credentials cannot be delivered.');
        }
        const host = smtp_config_1.smtpConfig.host;
        const port = smtp_config_1.smtpConfig.port;
        const secure = smtp_config_1.smtpConfig.secure;
        const senderEmail = smtp_config_1.smtpConfig.auth?.user || 'info@hostelghar.com';
        const fromAddress = smtp_config_1.smtpConfig.from || `HostelGhar <${senderEmail}>`;
        const mailOptions = {
            from: fromAddress,
            replyTo: senderEmail,
            to: payload.to,
            subject: payload.subject,
            text: payload.body,
            ...(payload.html ? { html: payload.html } : {}),
        };
        // 1. Try primary configured SMTP host
        try {
            const primaryTransporter = this.createTransporter(host, port, secure);
            const info = await primaryTransporter.sendMail(mailOptions);
            const responseCode = typeof info?.response === 'string'
                ? parseInt(info.response.split(' ')[0] ?? '', 10) || undefined
                : undefined;
            logger_1.logger.info('Email sent successfully via primary SMTP', {
                correlationId: options?.correlationId,
                jobId: options?.jobId,
                host,
                port,
                messageId: info.messageId,
                smtpResponse: info.response,
                smtpResponseCode: responseCode,
                recipientDomain: payload.to.split('@')[1] || 'unknown',
            });
            return true;
        }
        catch (primaryErr) {
            const errorCode = primaryErr?.code;
            const responseCode = primaryErr?.responseCode;
            logger_1.logger.warn('Primary SMTP delivery failed, attempting local cPanel fallback', {
                correlationId: options?.correlationId,
                jobId: options?.jobId,
                primaryHost: host,
                primaryPort: port,
                errorCode,
                smtpResponseCode: responseCode,
                error: primaryErr?.message || String(primaryErr),
                recipientDomain: payload.to.split('@')[1] || 'unknown',
            });
            // 2. On cPanel servers, CSF firewall or NAT loopback may block non-local connections.
            // Fall back to localhost / 127.0.0.1 Exim mailer
            const fallbackCandidates = [
                { host: '127.0.0.1', port: 465, secure: true },
                { host: '127.0.0.1', port: 587, secure: false },
                { host: 'localhost', port: 25, secure: false },
            ].filter((cand) => cand.host !== host || cand.port !== port);
            for (const candidate of fallbackCandidates) {
                try {
                    const fallbackTransporter = this.createTransporter(candidate.host, candidate.port, candidate.secure);
                    const fallbackInfo = await fallbackTransporter.sendMail(mailOptions);
                    const fallbackResponseCode = typeof fallbackInfo?.response === 'string'
                        ? parseInt(fallbackInfo.response.split(' ')[0] ?? '', 10) || undefined
                        : undefined;
                    logger_1.logger.info('Email sent successfully via local fallback SMTP', {
                        correlationId: options?.correlationId,
                        jobId: options?.jobId,
                        host: candidate.host,
                        port: candidate.port,
                        messageId: fallbackInfo.messageId,
                        smtpResponse: fallbackInfo.response,
                        smtpResponseCode: fallbackResponseCode,
                        recipientDomain: payload.to.split('@')[1] || 'unknown',
                    });
                    return true;
                }
                catch (fallbackErr) {
                    logger_1.logger.warn('SMTP fallback candidate failed', {
                        correlationId: options?.correlationId,
                        jobId: options?.jobId,
                        candidateHost: candidate.host,
                        candidatePort: candidate.port,
                        errorCode: fallbackErr?.code,
                        smtpResponseCode: fallbackErr?.responseCode,
                        error: fallbackErr?.message || String(fallbackErr),
                        recipientDomain: payload.to.split('@')[1] || 'unknown',
                    });
                }
            }
            // If all attempts failed, throw the primary error with full diagnostic context
            throw primaryErr;
        }
    }
    async verifyConnection() {
        if (!smtp_config_1.smtpConfig.enabled) {
            return {
                ok: false,
                host: smtp_config_1.smtpConfig.host || 'unset',
                port: smtp_config_1.smtpConfig.port,
                error: 'SMTP disabled',
            };
        }
        try {
            const transporter = this.createTransporter(smtp_config_1.smtpConfig.host, smtp_config_1.smtpConfig.port, smtp_config_1.smtpConfig.secure);
            await transporter.verify();
            return { ok: true, host: smtp_config_1.smtpConfig.host, port: smtp_config_1.smtpConfig.port };
        }
        catch (err) {
            return {
                ok: false,
                host: smtp_config_1.smtpConfig.host,
                port: smtp_config_1.smtpConfig.port,
                error: err?.message || String(err),
            };
        }
    }
}
exports.EmailSenderService = EmailSenderService;
exports.emailSenderService = new EmailSenderService();
