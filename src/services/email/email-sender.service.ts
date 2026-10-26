import { smtpConfig } from '../../configs/smtp.config';
import nodemailer, { Transporter } from 'nodemailer';
import { logger } from '../../observability/logger';

export interface SendEmailPayload {
  to: string;
  subject: string;
  body: string;
  html?: string;
}

export class EmailSenderService {
  private createTransporter(host: string, port: number, secure: boolean): Transporter {
    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: smtpConfig.auth,
      tls: {
        rejectUnauthorized: false, // Ensures compatibility with cPanel/shared SSL certificates
      },
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 8000,
    });
  }

  public async send(payload: SendEmailPayload): Promise<boolean> {
    if (!smtpConfig.enabled) {
      throw new Error('SMTP is not configured; owner credentials cannot be delivered.');
    }

    const host = smtpConfig.host;
    const port = smtpConfig.port;
    const secure = smtpConfig.secure;

    const mailOptions = {
      from: smtpConfig.from,
      to: payload.to,
      subject: payload.subject,
      text: payload.body,
      ...(payload.html ? { html: payload.html } : {}),
    };

    // 1. Try primary configured SMTP host
    try {
      const primaryTransporter = this.createTransporter(host, port, secure);
      await primaryTransporter.sendMail(mailOptions);
      logger.info('Email sent successfully via primary SMTP', { to: payload.to, host, port });
      return true;
    } catch (primaryErr: any) {
      logger.warn('Primary SMTP delivery failed, attempting local cPanel fallback', {
        to: payload.to,
        primaryHost: host,
        error: primaryErr?.message || String(primaryErr),
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
          const fallbackTransporter = this.createTransporter(
            candidate.host,
            candidate.port,
            candidate.secure,
          );
          await fallbackTransporter.sendMail(mailOptions);
          logger.info('Email sent successfully via local fallback SMTP', {
            to: payload.to,
            host: candidate.host,
            port: candidate.port,
          });
          return true;
        } catch (fallbackErr: any) {
          logger.warn('SMTP fallback candidate failed', {
            candidateHost: candidate.host,
            candidatePort: candidate.port,
            error: fallbackErr?.message || String(fallbackErr),
          });
        }
      }

      // If all attempts failed, throw the primary error with full diagnostic context
      throw primaryErr;
    }
  }

  public async verifyConnection(): Promise<{ ok: boolean; host: string; port: number; error?: string }> {
    if (!smtpConfig.enabled) {
      return { ok: false, host: smtpConfig.host || 'unset', port: smtpConfig.port, error: 'SMTP disabled' };
    }
    try {
      const transporter = this.createTransporter(smtpConfig.host, smtpConfig.port, smtpConfig.secure);
      await transporter.verify();
      return { ok: true, host: smtpConfig.host, port: smtpConfig.port };
    } catch (err: any) {
      return { ok: false, host: smtpConfig.host, port: smtpConfig.port, error: err?.message || String(err) };
    }
  }
}

export const emailSenderService = new EmailSenderService();
