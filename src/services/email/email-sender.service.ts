import { smtpConfig } from '../../configs/smtp.config';
import nodemailer from 'nodemailer';

export interface SendEmailPayload {
  to: string;
  subject: string;
  body: string;
}

export class EmailSenderService {
  private readonly transporter = smtpConfig.enabled
    ? nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        auth: smtpConfig.auth,
      })
    : null;

  public async send(payload: SendEmailPayload): Promise<boolean> {
    if (!smtpConfig.enabled) {
      throw new Error('SMTP is not configured; owner credentials cannot be delivered.');
    }

    await this.transporter!.sendMail({
      from: smtpConfig.from,
      to: payload.to,
      subject: payload.subject,
      text: payload.body,
    });
    return true;
  }
}

export const emailSenderService = new EmailSenderService();
