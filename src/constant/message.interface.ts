// ──────────────────────────────────────────────────────────────────────────────
// FILE: message.interface.ts
// PURPOSE: A single source-of-truth for every user-facing message string
//          returned by the API.
// ──────────────────────────────────────────────────────────────────────────────

export const MESSAGES = {
  // ===== Generic CRUD Messages =====
  SUCCESS: 'Operation successful',
  CREATED_SUCCESS: 'Resource created successfully',
  UPDATED_SUCCESS: 'Resource updated successfully',
  DELETED_SUCCESS: 'Resource deleted successfully',
  BAD_REQUEST: 'Bad request',
  UNAUTHORIZED: 'Unauthorized access',
  FORBIDDEN: 'Forbidden',
  NOT_FOUND: 'Resource not found',
  VALIDATION_ERROR: 'Validation error',
  INTERNAL_SERVER_ERROR: 'Internal server error',

  // ===== Auth — Registration =====
  USER_REGISTERED: 'User registered successfully',
  USER_CREATED_SUCCESS: 'User created successfully',
  USER_ALREADY_EXISTS: 'User already exists',
  USER_NOT_FOUND: 'User not found',

  // ===== Auth — Login / Logout =====
  LOGIN_SUCCESS: 'Login successful',
  LOGOUT_SUCCESS: 'Logout successful',
  INVALID_REQUEST: 'Invalid request',
  INVALID_EMAIL_OR_PASSWORD: 'Invalid email or password',

  // ===== Password Reset =====
  RESET_EMAIL_SENT: 'Reset email sent',
  RESET_TOKEN_INVALID: 'Reset token invalid',
  PASSWORD_RESET_SUCCESS: 'Password reset successful',

  // ===== Orders (domain-specific) =====
  ORDER_PLACED: 'Order placed successfully',

  // ===== Security / Session Messages =====
  ACCOUNT_LOCKED:
    'Account temporarily locked due to too many failed attempts. Please try again later.',
  ACCOUNT_INACTIVE: 'Account is inactive or disabled.',
  ACCOUNT_ALREADY_ACTIVE: 'This account is already active in another tab or device.',
  FORCED_LOGOUT: 'Your account was signed in from another device.',
  SESSION_EXPIRED: 'Session has expired. Please sign in again.',
  SESSION_INVALID: 'Invalid or expired session.',
  SESSION_REVOKED: 'Session revoked successfully.',
  SESSIONS_REVOKED: 'Sessions revoked successfully.',
  REGISTRATION_LIMIT_EXCEEDED:
    'Too many accounts created from this network. Please try again later.',
  REGISTRATION_DEVICE_LIMIT_EXCEEDED:
    'Too many accounts created on this device. Please try again later.',
  DEVICE_CHANGED: 'Sign-in detected from a new device. Verify your identity to continue.',
  IP_ANOMALY: 'Sign-in detected from an unusual location.',
  REFRESH_TOKEN_REUSE:
    'Security alert: refresh token reuse detected. All sessions have been revoked.',
  EMAIL_NOT_VERIFIED: 'Please verify your email address before signing in.',
  LOGIN_HISTORY_FETCHED: 'Login history fetched successfully.',
  SESSIONS_FETCHED: 'Active sessions fetched successfully.',
} as const;

export type Message = (typeof MESSAGES)[keyof typeof MESSAGES];
