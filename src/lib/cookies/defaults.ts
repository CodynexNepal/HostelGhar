import type { CookieCategory } from './categories';

export interface ConsentState {
  version: number;
  acceptedAt: string | null;
  categories: Record<CookieCategory, boolean>;
}

export const CONSENT_STORAGE_KEY = 'hostelghar:cookie-consent:v1';
export const CONSENT_VERSION = 1;

export function createDefaultConsentState(): ConsentState {
  return {
    version: CONSENT_VERSION,
    acceptedAt: null,
    categories: {
      essential: true,
      analytics: false,
      marketing: false,
      preferences: false,
    },
  };
}

export function createAcceptAllState(): ConsentState {
  return {
    version: CONSENT_VERSION,
    acceptedAt: new Date().toISOString(),
    categories: {
      essential: true,
      analytics: true,
      marketing: true,
      preferences: true,
    },
  };
}

export function createRejectOptionalState(): ConsentState {
  return {
    version: CONSENT_VERSION,
    acceptedAt: new Date().toISOString(),
    categories: {
      essential: true,
      analytics: false,
      marketing: false,
      preferences: false,
    },
  };
}
