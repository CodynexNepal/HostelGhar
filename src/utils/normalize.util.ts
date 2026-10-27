export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

/**
 * Redacts email addresses in logs to protect user privacy (e.g., "di***9@gmail.com").
 */
export const maskEmail = (email?: string): string => {
  if (!email || typeof email !== 'string' || !email.includes('@')) return '[UNKNOWN_RECIPIENT]';
  const parts = email.trim().split('@');
  const local = parts[0] ?? '';
  const domain = parts[1] ?? '';
  if (local.length <= 2) {
    return `${local.charAt(0)}***@${domain}`;
  }
  return `${local.slice(0, 2)}***${local.slice(-1)}@${domain}`;
};
