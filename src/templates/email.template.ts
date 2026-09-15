export type EmailTemplate = {
  subject: string;
  body: string;
};

export const renderWelcomeEmail = (firstName: string): EmailTemplate => ({
  subject: 'Welcome to HostelGhar',
  body: `Hi ${firstName},\n\nWelcome to HostelGhar. Your account is ready.\n\nRegards,\nHostelGhar Team`,
});

export const renderOwnerCredentialsEmail = (
  firstName: string,
  email: string,
  temporaryPassword: string,
): EmailTemplate => ({
  subject: 'Your HostelGhar owner account is ready',
  body:
    `Hi ${firstName},\n\n` +
    'An owner dashboard account has been created for you.\n\n' +
    `Login email: ${email}\n` +
    `Temporary password: ${temporaryPassword}\n\n` +
    'Please log in and change this password immediately. Do not share these credentials.\n\n' +
    'Regards,\nHostelGhar Team',
});

export const renderPasswordResetEmail = (firstName: string, resetToken: string): EmailTemplate => ({
  subject: 'Reset your HostelGhar password',
  body:
    `Hi ${firstName},\n\n` +
    `Use this password reset token to reset your password:\n\n${resetToken}\n\n` +
    'This token expires in 15 minutes. If you did not request this, ignore this email.\n\n' +
    'Regards,\nHostelGhar Security',
});

export const renderPasswordChangedEmail = (firstName: string): EmailTemplate => ({
  subject: 'Your HostelGhar password was changed',
  body:
    `Hi ${firstName},\n\n` +
    'Your HostelGhar password was changed successfully. If this was not you, contact support immediately.\n\n' +
    'Regards,\nHostelGhar Security',
});
