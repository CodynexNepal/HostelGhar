import { dotEnvConfig } from './envConfig';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  auth:
    | {
        user: string;
        pass: string;
      }
    | undefined;
  from: string;
  enabled: boolean;
}

export const smtpConfig: SmtpConfig = {
  host: dotEnvConfig.SMTP_HOST,
  port: dotEnvConfig.SMTP_PORT,
  secure: dotEnvConfig.SMTP_SECURE,
  auth:
    dotEnvConfig.SMTP_USER && dotEnvConfig.SMTP_PASS
      ? {
          user: dotEnvConfig.SMTP_USER,
          pass: dotEnvConfig.SMTP_PASS,
        }
      : undefined,
  from: dotEnvConfig.SMTP_FROM,
  enabled: Boolean(dotEnvConfig.SMTP_HOST),
};

export const assertSmtpConfigured = (): void => {
  if (!smtpConfig.enabled) {
    throw new Error('SMTP is not configured. Set SMTP_HOST before sending production email.');
  }
};
