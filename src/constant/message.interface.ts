// ──────────────────────────────────────────────────────────────────────────────
// FILE: message.interface.ts
// PURPOSE: A single source-of-truth for every user-facing message string
//          returned by the API. Centralizing messages here solves three problems:
//          1. Consistency — the same event always produces the same message.
//          2. Maintainability — changing a message requires editing one line.
//          3. i18n-readiness — this object can later be swapped for a
//             locale-specific dictionary without touching business logic.
// ──────────────────────────────────────────────────────────────────────────────

// The `as const` assertion makes every value a string-literal type rather
// than a broad `string`, enabling compile-time typo detection when comparing
// against message values elsewhere in the codebase.
export const MESSAGES = {
  // ===== Generic CRUD Messages =====
  // Used by any controller/service for standard operations so that response
  // phrasing is uniform across the entire API surface.
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
  // Specific messages for the registration flow so the client can display
  // contextual feedback to the user.
  USER_REGISTERED: 'User registered successfully',
  USER_CREATED_SUCCESS: 'User created successfully',
  USER_ALREADY_EXISTS: 'User already exists',
  USER_NOT_FOUND: 'User not found',

  // ===== Auth — Login / Logout =====
  LOGIN_SUCCESS: 'Login successful',
  LOGOUT_SUCCESS: 'Logout successful',
  INVALID_REQUEST: 'Invalid request',
  // Deliberately vague — telling the attacker which field was wrong
  // (email vs. password) leaks information about valid accounts.
  INVALID_EMAIL_OR_PASSWORD: 'Invalid email or password',

  // ===== Password Reset =====
  RESET_EMAIL_SENT: 'Reset email sent',
  RESET_TOKEN_INVALID: 'Reset token invalid',
  PASSWORD_RESET_SUCCESS: 'Password reset successful',

  // ===== Orders (domain-specific) =====
  ORDER_PLACED: 'Order placed successfully',

  // ===== Security / Session Messages =====
  // These cover edge-cases in a production auth system: brute-force
  // lockouts, session hijacking detection, and token rotation abuse.
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
  // Refresh-token reuse is a strong signal of token theft — the attacker
  // replayed an already-rotated token. Revoking ALL sessions is the only
  // safe response.
  REFRESH_TOKEN_REUSE:
    'Security alert: refresh token reuse detected. All sessions have been revoked.',
  EMAIL_NOT_VERIFIED: 'Please verify your email address before signing in.',
  LOGIN_HISTORY_FETCHED: 'Login history fetched successfully.',
  SESSIONS_FETCHED: 'Active sessions fetched successfully.',
} as const;

// Derive a TypeScript type from the frozen object so that other modules can
// type-check against the full set of message keys without importing the object.
export type IMessages = typeof MESSAGES;

// Re-export under a shorter alias for convenience in controllers/services.
export const Message = MESSAGES;
