export type CookieCategory =
  | 'essential'
  | 'analytics'
  | 'marketing'
  | 'preferences';

export interface CookieCategoryDefinition {
  id: CookieCategory;
  label: string;
  description: string;
  required: boolean;
  /** Example cookie names for documentation purposes. */
  exampleCookies: string[];
}

export const COOKIE_CATEGORIES: CookieCategoryDefinition[] = [
  {
    id: 'essential',
    label: 'Essential',
    description:
      'Required for the website to function. These include session management, security, and load balancing cookies. They cannot be disabled.',
    required: true,
    exampleCookies: ['session_id', 'csrf_token', 'load_balancer'],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    description:
      'Help us understand how visitors interact with the site by collecting anonymous usage data. No personal data is stored.',
    required: false,
    exampleCookies: ['_plausible', 'ph_phc_session'],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    description:
      'Used to deliver personalized content and ads, and to measure the effectiveness of marketing campaigns.',
    required: false,
    exampleCookies: ['_fbp', 'gtag'],
  },
  {
    id: 'preferences',
    label: 'Preferences',
    description:
      'Remember your choices such as language, region, and display settings to enhance your experience.',
    required: false,
    exampleCookies: ['locale', 'theme'],
  },
];

export const REQUIRED_CATEGORIES: CookieCategory[] = COOKIE_CATEGORIES.filter(
  (c) => c.required
).map((c) => c.id);

export const OPTIONAL_CATEGORIES: CookieCategory[] = COOKIE_CATEGORIES.filter(
  (c) => !c.required
).map((c) => c.id);
