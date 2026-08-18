// ──────────────────────────────────────────────────────────────────────────────
// FILE: cookie-manager.util.ts
// PURPOSE: Manages HTTP cookie creation and removal for authentication tokens.
//          Tokens are delivered via cookies — NOT in the JSON response body —
//          because cookies with proper security flags provide defense against
//          the two most dangerous web attacks:
//
//          1. XSS (Cross-Site Scripting):
//             `HttpOnly` cookies CANNOT be read by JavaScript. Even if an
//             attacker injects a script via XSS, they cannot steal the token.
//             If tokens were in the response body and stored in localStorage,
//             a single XSS vulnerability would leak them.
//
//          2. CSRF (Cross-Site Request Forgery):
//             `SameSite=Strict` ensures cookies are only sent on requests
//             originating from the SAME domain. A malicious site cannot
//             trick the browser into sending cookies to your API.
//
//          3. Man-in-the-Middle:
//             `Secure` flag ensures cookies are only sent over HTTPS,
//             preventing interception on insecure networks.
//
// OOP PRINCIPLES:
//   • Encapsulation — cookie option details are hidden from controllers.
//   • Single Responsibility — this class ONLY manages auth cookies.
//   • Static utility class — no instance state needed.
// ──────────────────────────────────────────────────────────────────────────────

// Import the Express Response type so we can set cookies on it.
import { Response } from 'express';

// Import env config to determine if we're in production (affects Secure flag).
import { dotEnvConfig } from '../configs/envConfig';

// ─── CookieManager Class ───────────────────────────────────────────────────

export class CookieManager {
  // ─── Cookie Name Constants ────────────────────────────────────────────

  // Define cookie names as static constants to avoid typos.
  public static readonly ACCESS_TOKEN_COOKIE = 'access_token';
  public static readonly REFRESH_TOKEN_COOKIE = 'refresh_token';

  // ─── Private Constructor ──────────────────────────────────────────────

  // Prevent instantiation — all methods are static utilities.
  private constructor() {
    // Intentionally empty — exists only to prevent `new CookieManager()`.
  }

  // ─── setAuthCookies() ─────────────────────────────────────────────────

  // Attaches both access and refresh tokens as HttpOnly cookies on the
  // Express response. Called after successful login or registration.
  public static setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
    // ─── Access Token Cookie ──────────────────────────────────────────
    res.cookie(CookieManager.ACCESS_TOKEN_COOKIE, accessToken, {
      httpOnly: true,
      secure: dotEnvConfig.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
      path: '/',
    });

    // ─── Refresh Token Cookie ─────────────────────────────────────────
    res.cookie(CookieManager.REFRESH_TOKEN_COOKIE, refreshToken, {
      httpOnly: true,
      secure: dotEnvConfig.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/v1/hostel-ghar/auth',
    });
  }

  // ─── clearAuthCookies() ───────────────────────────────────────────────

  // Removes both authentication cookies from the browser. Called on logout.
  public static clearAuthCookies(res: Response): void {
    res.clearCookie(CookieManager.ACCESS_TOKEN_COOKIE, {
      httpOnly: true,
      secure: dotEnvConfig.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });

    res.clearCookie(CookieManager.REFRESH_TOKEN_COOKIE, {
      httpOnly: true,
      secure: dotEnvConfig.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/v1/hostel-ghar/auth',
    });
  }
}
