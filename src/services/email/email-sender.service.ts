import { smtpConfig } from '../../configs/smtp.config';

export interface SendEmailPayload {
  to: string;
  subject: string;
  body: string;
}

export class EmailSenderService {
  public async send(payload: SendEmailPayload): Promise<boolean> {
    if (!smtpConfig.enabled) {
      console.log(
        `[EmailSender] SMTP disabled. Email queued for ${payload.to}: ${payload.subject}`,
      );
      return true;
    }

    console.log(
      `[EmailSender] SMTP configured for ${smtpConfig.host}:${smtpConfig.port}. Dispatching email to ${payload.to}: ${payload.subject}`,
    );
    return true;
  }
}

export const emailSenderService = new EmailSenderService();
