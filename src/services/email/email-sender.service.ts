import { smtpConfig } from '../../configs/smtp.config';
import nodemailer, { Transporter, SendMailOptions } from 'nodemailer';
import { logger } from '../../observability/logger';

export interface SendEmailPayload {
  to: string;
  subject: string;
  body: string;
  html?: string;
}

export interface SendEmailOptions {
  correlationId?: string | undefined;
  jobId?: string | undefined;
}

export class EmailSenderService {
  private primaryTransporterInstance: Transporter | null = null;

  private createTransporter(host: string, port: number, secure: boolean): Transporter {
    return nodemailer.createTransport({
      name: 'hostelghar.com', // Explicit FQDN EHLO/HELO domain avoids reverse DNS/HELO mismatch in Exim & Gmail
      host,
      port,
      secure,
      auth: smtpConfig.auth,
      tls: {
        rejectUnauthorized: false, // Ensures compatibility with cPanel/shared SSL certificates
      },
      connectionTimeout: 4000,
      greetingTimeout: 4000,
      socketTimeout: 8000,
    });
  }

  public async send(payload: SendEmailPayload, options?: SendEmailOptions): Promise<boolean> {
    if (!smtpConfig.enabled) {
      throw new Error('SMTP is not configured; owner credentials cannot be delivered.');
    }

    const host = smtpConfig.host;
    const port = smtpConfig.port;
    const secure = smtpConfig.secure;

    const senderEmail = smtpConfig.auth?.user || 'info@hostelghar.com';
    const fromAddress = smtpConfig.from || `HostelGhar <${senderEmail}>`;

    const mailOptions: SendMailOptions = {
      from: fromAddress,
      sender: senderEmail,
      replyTo: senderEmail,
      to: payload.to,
      subject: payload.subject,
      text: payload.body,
      ...(payload.html ? { html: payload.html } : {}),
      envelope: {
        from: senderEmail,
        to: payload.to,
      },
      headers: {
        'X-Mailer': 'HostelGhar-Mailer',
        'X-Entity-Ref-ID': options?.correlationId || options?.jobId || payload.to,
      },
    };

    // 1. Try primary configured SMTP host
    try {
      const primaryTransporter = this.createTransporter(host, port, secure);
      const info = await primaryTransporter.sendMail(mailOptions);
      const responseCode =
        typeof info?.response === 'string'
          ? parseInt(info.response.split(' ')[0] ?? '', 10) || undefined
          : undefined;

      logger.info('Email sent successfully via primary SMTP', {
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
    } catch (primaryErr: any) {
      const errorCode = primaryErr?.code;
      const responseCode = primaryErr?.responseCode;

      logger.warn('Primary SMTP delivery failed, attempting local cPanel fallback', {
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
          const fallbackTransporter = this.createTransporter(
            candidate.host,
            candidate.port,
            candidate.secure,
          );
          const fallbackInfo = await fallbackTransporter.sendMail(mailOptions);
          const fallbackResponseCode =
            typeof fallbackInfo?.response === 'string'
              ? parseInt(fallbackInfo.response.split(' ')[0] ?? '', 10) || undefined
              : undefined;

          logger.info('Email sent successfully via local fallback SMTP', {
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
        } catch (fallbackErr: any) {
          logger.warn('SMTP fallback candidate failed', {
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

  public async verifyConnection(): Promise<{
    ok: boolean;
    host: string;
    port: number;
    error?: string;
  }> {
    if (!smtpConfig.enabled) {
      return {
        ok: false,
        host: smtpConfig.host || 'unset',
        port: smtpConfig.port,
        error: 'SMTP disabled',
      };
    }
    try {
      const transporter = this.createTransporter(
        smtpConfig.host,
        smtpConfig.port,
        smtpConfig.secure,
      );
      await transporter.verify();
      return { ok: true, host: smtpConfig.host, port: smtpConfig.port };
    } catch (err: any) {
      return {
        ok: false,
        host: smtpConfig.host,
        port: smtpConfig.port,
        error: err?.message || String(err),
      };
    }
  }
}

export const emailSenderService = new EmailSenderService();
