// ──────────────────────────────────────────────────────────────────────────────
// FILE: subscription.constant.ts
// PURPOSE: Complete definition of subscription tiers, pricing, features, and limits.
// ──────────────────────────────────────────────────────────────────────────────

import { SubscriptionPlan } from '../enum/subscription.enum';

export interface PlanFeatureDetails {
  basicDashboard: boolean;
  basicHostelProfile: boolean;
  maxResidents: number | null; // null = unlimited
  maxHostels: number | null; // null = unlimited
  roomManagement: boolean;
  staffManagement: boolean;
  reportsAndAnalytics: boolean;
  basicPayments: boolean;
  expensesTracking: boolean;
  advancedAnalytics: boolean;
  reportsAndExports: boolean;
  invoicesAndReminders: boolean;
  multipleHostels: boolean;
  advancedAdministration: boolean;
  advancedReporting: boolean;
  prioritySupport: boolean;
  customIntegrations: boolean;
}

export interface SubscriptionPlanDefinition {
  id: SubscriptionPlan;
  name: string;
  tagline: string;
  price: number;
  currency: string;
  billingPeriod: string;
  formattedPrice: string;
  badge?: string;
  isCurrentDefault?: boolean;
  features: string[];
  buttonText: string;
  limits: {
    maxResidents: number | null;
    maxHostels: number | null;
  };
  featureFlags: PlanFeatureDetails;
}

export const SUBSCRIPTION_PLANS: Record<SubscriptionPlan, SubscriptionPlanDefinition> = {
  [SubscriptionPlan.FREE]: {
    id: SubscriptionPlan.FREE,
    name: 'Free',
    tagline: 'Get started with hostel basics.',
    price: 0,
    currency: 'NPR',
    billingPeriod: 'month',
    formattedPrice: 'Free/mo',
    badge: 'Current',
    isCurrentDefault: true,
    buttonText: 'Current Plan',
    features: [
      'Basic dashboard',
      'Basic hostel profile',
      'Up to 10 residents',
      'Room management',
      'Staff management',
      'Reports & analytics',
    ],
    limits: {
      maxResidents: 10,
      maxHostels: 1,
    },
    featureFlags: {
      basicDashboard: true,
      basicHostelProfile: true,
      maxResidents: 10,
      maxHostels: 1,
      roomManagement: true,
      staffManagement: true,
      reportsAndAnalytics: true,
      basicPayments: false,
      expensesTracking: false,
      advancedAnalytics: false,
      reportsAndExports: false,
      invoicesAndReminders: false,
      multipleHostels: false,
      advancedAdministration: false,
      advancedReporting: false,
      prioritySupport: false,
      customIntegrations: false,
    },
  },
  [SubscriptionPlan.BASIC]: {
    id: SubscriptionPlan.BASIC,
    name: 'Basic',
    tagline: 'For small hostels getting organized.',
    price: 999,
    currency: 'NPR',
    billingPeriod: 'month',
    formattedPrice: 'Rs. 999/mo',
    buttonText: 'Upgrade to Basic',
    features: [
      'Up to 60 residents',
      'Room management',
      'Basic payments',
      'Expenses tracking',
      'Reports & analytics',
    ],
    limits: {
      maxResidents: 60,
      maxHostels: 1,
    },
    featureFlags: {
      basicDashboard: true,
      basicHostelProfile: true,
      maxResidents: 60,
      maxHostels: 1,
      roomManagement: true,
      staffManagement: false,
      reportsAndAnalytics: true,
      basicPayments: true,
      expensesTracking: true,
      advancedAnalytics: false,
      reportsAndExports: false,
      invoicesAndReminders: false,
      multipleHostels: false,
      advancedAdministration: false,
      advancedReporting: false,
      prioritySupport: false,
      customIntegrations: false,
    },
  },
  [SubscriptionPlan.PRO]: {
    id: SubscriptionPlan.PRO,
    name: 'Pro',
    tagline: 'For growing hostels that need automation.',
    badge: 'Popular',
    price: 1999,
    currency: 'NPR',
    billingPeriod: 'month',
    formattedPrice: 'Rs. 1,999/mo',
    buttonText: 'Upgrade to Pro',
    features: [
      'Unlimited residents',
      'Staff management',
      'Advanced analytics',
      'Reports & exports',
      'Invoices & reminders',
    ],
    limits: {
      maxResidents: null, // Unlimited
      maxHostels: 1,
    },
    featureFlags: {
      basicDashboard: true,
      basicHostelProfile: true,
      maxResidents: null,
      maxHostels: 1,
      roomManagement: true,
      staffManagement: true,
      reportsAndAnalytics: true,
      basicPayments: true,
      expensesTracking: true,
      advancedAnalytics: true,
      reportsAndExports: true,
      invoicesAndReminders: true,
      multipleHostels: false,
      advancedAdministration: false,
      advancedReporting: false,
      prioritySupport: false,
      customIntegrations: false,
    },
  },
  [SubscriptionPlan.ENTERPRISE]: {
    id: SubscriptionPlan.ENTERPRISE,
    name: 'Enterprise',
    tagline: 'For groups and multi-hostel operators.',
    price: 4999,
    currency: 'NPR',
    billingPeriod: 'month',
    formattedPrice: 'Rs. 4,999/mo',
    buttonText: 'Contact Sales',
    features: [
      'Multiple hostels',
      'Advanced administration',
      'Advanced reporting',
      'Priority support',
      'Custom integrations',
    ],
    limits: {
      maxResidents: null, // Unlimited
      maxHostels: null, // Multiple hostels / Unlimited
    },
    featureFlags: {
      basicDashboard: true,
      basicHostelProfile: true,
      maxResidents: null,
      maxHostels: null,
      roomManagement: true,
      staffManagement: true,
      reportsAndAnalytics: true,
      basicPayments: true,
      expensesTracking: true,
      advancedAnalytics: true,
      reportsAndExports: true,
      invoicesAndReminders: true,
      multipleHostels: true,
      advancedAdministration: true,
      advancedReporting: true,
      prioritySupport: true,
      customIntegrations: true,
    },
  },
};

export const DEFAULT_PLAN = SubscriptionPlan.FREE;

export function getPlanDefinition(plan: SubscriptionPlan | string): SubscriptionPlanDefinition {
  const normalized = (plan || SubscriptionPlan.FREE).toUpperCase() as SubscriptionPlan;
  return SUBSCRIPTION_PLANS[normalized] || SUBSCRIPTION_PLANS[SubscriptionPlan.FREE];
}
