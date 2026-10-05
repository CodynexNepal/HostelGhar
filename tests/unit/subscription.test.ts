// ──────────────────────────────────────────────────────────────────────────────
// FILE: subscription.test.ts
// PURPOSE: Unit tests for subscription tiers, feature flags, limits, and upgrades.
// ──────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SUBSCRIPTION_PLANS, getPlanDefinition } from '../../src/constant/subscription.constant';
import {
  BillingCycle,
  SubscriptionPlan,
  SubscriptionStatus,
} from '../../src/enum/subscription.enum';
import { SubscriptionService } from '../../src/services/subscription/subscription.service';
import { SubscriptionRepository } from '../../src/repository/subscription/subscription.repository';

describe('Subscription Plans Definition', () => {
  it('defines the 4 tiers: Free, Basic, Pro, Enterprise', () => {
    expect(SUBSCRIPTION_PLANS[SubscriptionPlan.FREE]).toBeDefined();
    expect(SUBSCRIPTION_PLANS[SubscriptionPlan.BASIC]).toBeDefined();
    expect(SUBSCRIPTION_PLANS[SubscriptionPlan.PRO]).toBeDefined();
    expect(SUBSCRIPTION_PLANS[SubscriptionPlan.ENTERPRISE]).toBeDefined();
  });

  describe('Free Plan', () => {
    const plan = SUBSCRIPTION_PLANS[SubscriptionPlan.FREE];

    it('has correct pricing and metadata', () => {
      expect(plan.name).toBe('Free');
      expect(plan.tagline).toBe('Get started with hostel basics.');
      expect(plan.price).toBe(0);
      expect(plan.formattedPrice).toBe('Free/mo');
      expect(plan.badge).toBe('Current');
      expect(plan.buttonText).toBe('Current Plan');
      expect(plan.limits.maxResidents).toBe(10);
      expect(plan.limits.maxHostels).toBe(1);
    });

    it('has all required features listed in exact order', () => {
      expect(plan.features).toEqual([
        'Basic dashboard',
        'Basic hostel profile',
        'Up to 10 residents',
        'Room management',
        'Staff management',
        'Reports & analytics',
      ]);
    });
  });

  describe('Basic Plan', () => {
    const plan = SUBSCRIPTION_PLANS[SubscriptionPlan.BASIC];

    it('has correct pricing and metadata', () => {
      expect(plan.name).toBe('Basic');
      expect(plan.tagline).toBe('For small hostels getting organized.');
      expect(plan.price).toBe(999);
      expect(plan.formattedPrice).toBe('Rs. 999/mo');
      expect(plan.buttonText).toBe('Upgrade to Basic');
      expect(plan.limits.maxResidents).toBe(60);
      expect(plan.limits.maxHostels).toBe(1);
    });

    it('has all required features listed in exact order', () => {
      expect(plan.features).toEqual([
        'Up to 60 residents',
        'Room management',
        'Basic payments',
        'Expenses tracking',
        'Reports & analytics',
      ]);
    });
  });

  describe('Pro Plan', () => {
    const plan = SUBSCRIPTION_PLANS[SubscriptionPlan.PRO];

    it('has correct pricing and metadata', () => {
      expect(plan.name).toBe('Pro');
      expect(plan.tagline).toBe('For growing hostels that need automation.');
      expect(plan.badge).toBe('Popular');
      expect(plan.price).toBe(1999);
      expect(plan.formattedPrice).toBe('Rs. 1,999/mo');
      expect(plan.buttonText).toBe('Upgrade to Pro');
      expect(plan.limits.maxResidents).toBeNull(); // Unlimited
      expect(plan.limits.maxHostels).toBe(1);
    });

    it('has all required features listed in exact order', () => {
      expect(plan.features).toEqual([
        'Unlimited residents',
        'Staff management',
        'Advanced analytics',
        'Reports & exports',
        'Invoices & reminders',
      ]);
    });
  });

  describe('Enterprise Plan', () => {
    const plan = SUBSCRIPTION_PLANS[SubscriptionPlan.ENTERPRISE];

    it('has correct pricing and metadata', () => {
      expect(plan.name).toBe('Enterprise');
      expect(plan.tagline).toBe('For groups and multi-hostel operators.');
      expect(plan.price).toBe(4999);
      expect(plan.formattedPrice).toBe('Rs. 4,999/mo');
      expect(plan.buttonText).toBe('Contact Sales');
      expect(plan.limits.maxResidents).toBeNull(); // Unlimited
      expect(plan.limits.maxHostels).toBeNull(); // Multiple hostels
    });

    it('has all required features listed in exact order', () => {
      expect(plan.features).toEqual([
        'Multiple hostels',
        'Advanced administration',
        'Advanced reporting',
        'Priority support',
        'Custom integrations',
      ]);
    });
  });

  it('getPlanDefinition falls back safely to FREE plan', () => {
    expect(getPlanDefinition('UNKNOWN').id).toBe(SubscriptionPlan.FREE);
    expect(getPlanDefinition(SubscriptionPlan.PRO).id).toBe(SubscriptionPlan.PRO);
  });
});

describe('SubscriptionService', () => {
  let mockRepo: Partial<SubscriptionRepository>;
  let service: SubscriptionService;

  beforeEach(() => {
    mockRepo = {
      findActiveSubscription: vi.fn(),
      findByOwner: vi.fn(),
      create: vi.fn((data) => data as any),
      save: vi.fn(async (data) => ({ id: 'sub-123', ...data }) as any),
      deactivateExistingActive: vi.fn(async () => {}),
      countActiveResidents: vi.fn(async () => 5),
      countOwnerHostels: vi.fn(async () => 1),
      findHostelById: vi.fn(async () => ({ id: 'hostel-1', ownerId: 'owner-1' }) as any),
    };
    service = new SubscriptionService(mockRepo as SubscriptionRepository);
  });

  describe('getAllPlans', () => {
    it('returns 4 plans and highlights current plan correctly', () => {
      const plans = service.getAllPlans(SubscriptionPlan.BASIC);
      expect(plans).toHaveLength(4);

      const basic = plans.find((p) => p.id === SubscriptionPlan.BASIC);
      expect(basic?.isCurrent).toBe(true);
      expect(basic?.buttonText).toBe('Current Plan');

      const pro = plans.find((p) => p.id === SubscriptionPlan.PRO);
      expect(pro?.isCurrent).toBe(false);
      expect(pro?.buttonText).toBe('Upgrade to Pro');
    });
  });

  describe('checkResidentLimit', () => {
    it('allows resident creation when under Free limit (10)', async () => {
      mockRepo.findActiveSubscription = vi.fn().mockResolvedValue(null); // Defaults to FREE
      mockRepo.countActiveResidents = vi.fn().mockResolvedValue(8);

      const result = await service.checkResidentLimit('hostel-1', 1);
      expect(result.allowed).toBe(true);
      expect(result.currentCount).toBe(8);
      expect(result.limit).toBe(10);
    });

    it('blocks resident creation when reaching Free limit (10)', async () => {
      mockRepo.findActiveSubscription = vi.fn().mockResolvedValue(null); // Free
      mockRepo.countActiveResidents = vi.fn().mockResolvedValue(10);

      const result = await service.checkResidentLimit('hostel-1', 1);
      expect(result.allowed).toBe(false);
      expect(result.message).toContain('Resident limit reached for Free plan');
      expect(result.message).toContain('Upgrade to Basic (up to 60 residents) or Pro');
    });

    it('allows up to 60 residents on Basic plan', async () => {
      mockRepo.findActiveSubscription = vi.fn().mockResolvedValue({
        plan: SubscriptionPlan.BASIC,
        status: SubscriptionStatus.ACTIVE,
      });
      mockRepo.countActiveResidents = vi.fn().mockResolvedValue(59);

      const result = await service.checkResidentLimit('hostel-1', 1);
      expect(result.allowed).toBe(true);

      mockRepo.countActiveResidents = vi.fn().mockResolvedValue(60);
      const blockedResult = await service.checkResidentLimit('hostel-1', 1);
      expect(blockedResult.allowed).toBe(false);
      expect(blockedResult.message).toContain('Upgrade to Pro for unlimited residents');
    });

    it('allows unlimited residents on Pro plan', async () => {
      mockRepo.findActiveSubscription = vi.fn().mockResolvedValue({
        plan: SubscriptionPlan.PRO,
        status: SubscriptionStatus.ACTIVE,
      });
      mockRepo.countActiveResidents = vi.fn().mockResolvedValue(500);

      const result = await service.checkResidentLimit('hostel-1', 10);
      expect(result.allowed).toBe(true);
      expect(result.limit).toBeNull();
    });
  });

  describe('checkHostelLimit', () => {
    it('limits Free, Basic, Pro owners to 1 hostel', async () => {
      mockRepo.findActiveSubscription = vi.fn().mockResolvedValue({
        plan: SubscriptionPlan.BASIC,
        status: SubscriptionStatus.ACTIVE,
      });
      mockRepo.countOwnerHostels = vi.fn().mockResolvedValue(1);

      const result = await service.checkHostelLimit('owner-1', 1);
      expect(result.allowed).toBe(false);
      expect(result.message).toContain('Upgrade to Enterprise to manage multiple hostels');
    });

    it('allows multiple hostels on Enterprise plan', async () => {
      mockRepo.findActiveSubscription = vi.fn().mockResolvedValue({
        plan: SubscriptionPlan.ENTERPRISE,
        status: SubscriptionStatus.ACTIVE,
      });
      mockRepo.countOwnerHostels = vi.fn().mockResolvedValue(5);

      const result = await service.checkHostelLimit('owner-1', 1);
      expect(result.allowed).toBe(true);
      expect(result.limit).toBeNull();
    });
  });

  describe('subscribe', () => {
    it('downgrades to FREE instantly (no payment proof required)', async () => {
      const result = await service.subscribe('owner-1', {
        plan: SubscriptionPlan.FREE,
        billingCycle: BillingCycle.MONTHLY,
      });

      expect(mockRepo.deactivateExistingActive).toHaveBeenCalledWith('owner-1', undefined);
      expect(result.requiresApproval).toBe(false);
      expect(result.subscription.plan).toBe(SubscriptionPlan.FREE);
      expect(result.subscription.status).toBe(SubscriptionStatus.ACTIVE);
      expect(result.subscription.endDate).toBeNull();
    });

    it('creates a PENDING request (proof attached) without touching the active plan', async () => {
      mockRepo.findPendingRequest = vi.fn().mockResolvedValue(null);

      const result = await service.subscribe('owner-1', {
        plan: SubscriptionPlan.PRO,
        billingCycle: BillingCycle.MONTHLY,
        paymentMethod: 'ESEWA' as never,
        paymentReference: '12345',
        proofUrl: 'https://res.cloudinary.com/demo/proof.png',
      });

      // The current plan must NOT be deactivated before admin approval.
      expect(mockRepo.deactivateExistingActive).not.toHaveBeenCalled();
      expect(result.requiresApproval).toBe(true);
      expect(result.subscription.status).toBe(SubscriptionStatus.PENDING);
      expect(result.subscription.plan).toBe(SubscriptionPlan.PRO);
      expect(result.subscription.price).toBe(1999);
      expect(result.subscription.endDate).toBeNull();
      expect(result.subscription.proofUrl).toBe('https://res.cloudinary.com/demo/proof.png');
      expect(result.plan.name).toBe('Pro');
    });

    it('rejects a paid plan request without a payment proof', async () => {
      const promise = service.subscribe('owner-1', {
        plan: SubscriptionPlan.BASIC,
        billingCycle: BillingCycle.MONTHLY,
      });

      await expect(promise).rejects.toMatchObject({ statusCode: 400 });
      await expect(service.subscribe('owner-1', { plan: SubscriptionPlan.BASIC })).rejects.toThrow(
        /Payment proof screenshot is required/,
      );
    });

    it('blocks a second request while one is already PENDING', async () => {
      mockRepo.findPendingRequest = vi.fn().mockResolvedValue({
        id: 'sub-pending',
        plan: SubscriptionPlan.PRO,
        status: SubscriptionStatus.PENDING,
      });

      await expect(
        service.subscribe('owner-1', {
          plan: SubscriptionPlan.ENTERPRISE,
          proofUrl: 'https://res.cloudinary.com/demo/proof.png',
        }),
      ).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  describe('reviewRequest', () => {
    const pendingRequest = () => ({
      id: 'req-1',
      ownerId: 'owner-1',
      hostelId: 'hostel-1',
      plan: SubscriptionPlan.PRO,
      status: SubscriptionStatus.PENDING,
      billingCycle: BillingCycle.MONTHLY,
      price: 1999,
      currency: 'NPR',
      startDate: new Date(),
      endDate: null,
    });

    it('approves: activates the requested plan and expires the old one', async () => {
      mockRepo.findById = vi.fn().mockResolvedValue(pendingRequest());

      const result = await service.reviewRequest('admin-1', 'admin', 'req-1', {
        action: 'APPROVE' as never,
      });

      expect(mockRepo.deactivateExistingActive).toHaveBeenCalledWith('owner-1', 'hostel-1');
      expect(result.subscription.status).toBe(SubscriptionStatus.ACTIVE);
      expect(result.subscription.plan).toBe(SubscriptionPlan.PRO);
      expect(result.subscription.reviewedBy).toBe('admin-1');
      expect(result.subscription.reviewedAt).toBeInstanceOf(Date);
      expect(result.subscription.endDate).toBeInstanceOf(Date);
      expect(result.plan.name).toBe('Pro');
    });

    it('rejects: marks the request REJECTED and activates nothing', async () => {
      mockRepo.findById = vi.fn().mockResolvedValue(pendingRequest());

      const result = await service.reviewRequest('admin-1', 'admin', 'req-1', {
        action: 'REJECT' as never,
        note: 'Screenshot amount does not match',
      });

      expect(mockRepo.deactivateExistingActive).not.toHaveBeenCalled();
      expect(result.subscription.status).toBe(SubscriptionStatus.REJECTED);
      expect(result.subscription.reviewNote).toBe('Screenshot amount does not match');
    });

    it('forbids non-admin reviewers', async () => {
      mockRepo.findById = vi.fn().mockResolvedValue(pendingRequest());

      await expect(
        service.reviewRequest('owner-1', 'owner', 'req-1', { action: 'APPROVE' as never }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('cannot review the same request twice', async () => {
      mockRepo.findById = vi.fn().mockResolvedValue({
        ...pendingRequest(),
        status: SubscriptionStatus.REJECTED,
      });

      await expect(
        service.reviewRequest('admin-1', 'admin', 'req-1', { action: 'APPROVE' as never }),
      ).rejects.toMatchObject({ statusCode: 409 });
    });
  });
});
