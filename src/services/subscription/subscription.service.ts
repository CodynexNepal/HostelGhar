// ──────────────────────────────────────────────────────────────────────────────
// FILE: subscription.service.ts
// PURPOSE: Business logic for plans, upgrades, limits, and subscription lifecycle.
// ──────────────────────────────────────────────────────────────────────────────

import { SubscriptionRepository } from '../../repository/subscription/subscription.repository';
import {
  SUBSCRIPTION_PLANS,
  SubscriptionPlanDefinition,
  getPlanDefinition,
} from '../../constant/subscription.constant';
import {
  BillingCycle,
  SubscriptionPlan,
  SubscriptionReviewAction,
  SubscriptionStatus,
} from '../../enum/subscription.enum';
import { SubscribeDto } from '../../dto/subscription/subscribe.dto';
import { ReviewSubscriptionDto } from '../../dto/subscription/review-subscription.dto';
import { Subscription } from '../../entities/subscription/subscription.entity';
import { cacheService } from '../../utils/cache.util';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { IROLES } from '../../enum/roles.enum';
import { createHttpError } from '../../utils/createHttpError';
import { imageUploadService } from '../upload/image-upload.service';
import { createPaginatedResponse, PaginatedResponse } from '../../utils/pagination.util';
import type { ProofPaymentMethod } from '../../enum/payment-proof.enum';

export interface ResidentLimitCheckResult {
  allowed: boolean;
  currentPlan: SubscriptionPlan;
  planName: string;
  limit: number | null;
  currentCount: number;
  message?: string;
}

export interface HostelLimitCheckResult {
  allowed: boolean;
  currentPlan: SubscriptionPlan;
  planName: string;
  limit: number | null;
  currentCount: number;
  message?: string;
}

/** Shape the dashboard's admin review queue consumes. */
export interface SerializedSubscriptionRequest {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerEmail?: string | undefined;
  hostelId: string | null;
  hostelName?: string | undefined;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  price: number;
  currency: string;
  paymentMethod?: ProofPaymentMethod | null;
  paymentReference?: string | null;
  notes?: string | null;
  proofUrl?: string | null;
  reviewNote?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  startDate?: string;
  endDate?: string | null;
  createdAt: string;
}

export class SubscriptionService {
  constructor(private readonly subscriptionRepository: SubscriptionRepository) {}

  /**
   * Returns all available subscription plans with complete feature lists,
   * pricing, limits, and dynamic current-plan indicator.
   */
  public getAllPlans(
    currentPlan?: SubscriptionPlan,
  ): (SubscriptionPlanDefinition & { isCurrent: boolean })[] {
    const activePlan = currentPlan || SubscriptionPlan.FREE;

    return Object.values(SUBSCRIPTION_PLANS).map((plan) => {
      const isCurrent = plan.id === activePlan;
      return {
        ...plan,
        isCurrent,
        buttonText: isCurrent
          ? plan.id === SubscriptionPlan.FREE
            ? 'Current Plan'
            : 'Current Plan'
          : plan.buttonText,
      };
    });
  }

  /**
   * Retrieves the current active subscription details for an owner or hostel.
   * If none exists or has expired, defaults cleanly to the FREE plan.
   */
  public async getCurrentSubscription(params: {
    ownerId: string;
    hostelId?: string | undefined;
  }): Promise<{
    subscription: Partial<Subscription> | null;
    plan: SubscriptionPlanDefinition;
    limits: {
      residentCount: number;
      residentLimit: number | null;
      residentLimitReached: boolean;
      hostelCount: number;
      hostelLimit: number | null;
      hostelLimitReached: boolean;
    };
    daysRemaining: number | null;
  }> {
    const activeSub = await this.subscriptionRepository.findActiveSubscription(params);
    const planId = activeSub ? activeSub.plan : SubscriptionPlan.FREE;
    const planDef = getPlanDefinition(planId);

    // Calculate usage metrics
    const residentCount = params.hostelId
      ? await this.subscriptionRepository.countActiveResidents(params.hostelId)
      : 0;

    const hostelCount = await this.subscriptionRepository.countOwnerHostels(params.ownerId);

    const residentLimit = planDef.limits.maxResidents;
    const residentLimitReached = residentLimit !== null ? residentCount >= residentLimit : false;

    const hostelLimit = planDef.limits.maxHostels;
    const hostelLimitReached = hostelLimit !== null ? hostelCount >= hostelLimit : false;

    let daysRemaining: number | null = null;
    if (activeSub && activeSub.endDate) {
      const diffMs = new Date(activeSub.endDate).getTime() - Date.now();
      daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }

    return {
      subscription: activeSub,
      plan: planDef,
      limits: {
        residentCount,
        residentLimit,
        residentLimitReached,
        hostelCount,
        hostelLimit,
        hostelLimitReached,
      },
      daysRemaining,
    };
  }

  /**
   * Requests a plan change for an owner.
   *
   * - FREE: instant self-serve downgrade (no payment involved).
   * - BASIC / PRO / ENTERPRISE: the owner MUST attach a payment-proof
   *   screenshot. The row is stored as PENDING and the currently active plan
   *   keeps running until an admin approves it via `reviewRequest()` — there
   *   is no eSewa integration, so activation is manual.
   */
  public async subscribe(
    ownerId: string,
    dto: SubscribeDto,
    file?: Express.Multer.File,
  ): Promise<{
    subscription: Subscription;
    plan: SubscriptionPlanDefinition;
    requiresApproval: boolean;
  }> {
    const planDef = getPlanDefinition(dto.plan);
    const cycle = dto.billingCycle || BillingCycle.MONTHLY;

    // ── FREE: downgrade only, nothing to verify → instant ───────────────────
    if (dto.plan === SubscriptionPlan.FREE) {
      await this.subscriptionRepository.deactivateExistingActive(ownerId, dto.hostelId);

      const saved = await this.subscriptionRepository.save(
        this.subscriptionRepository.create({
          ownerId,
          hostelId: dto.hostelId || null,
          plan: SubscriptionPlan.FREE,
          status: SubscriptionStatus.ACTIVE,
          billingCycle: cycle,
          price: 0,
          currency: planDef.currency,
          startDate: new Date(),
          endDate: null,
          autoRenew: false,
          paymentReference: dto.paymentReference || null,
          notes: dto.notes || null,
        }),
      );

      await this.bustSubscriptionCaches();
      return { subscription: saved, plan: planDef, requiresApproval: false };
    }

    // ── Paid plans: payment proof + admin approval required ─────────────────
    let proofUrl = dto.proofUrl?.trim() || null;
    let proofPublicId: string | null = null;
    if (file?.buffer) {
      const uploaded = await imageUploadService.uploadSubscriptionProofScreenshot(file, ownerId);
      proofUrl = uploaded.url;
      proofPublicId = uploaded.publicId;
    }

    if (!proofUrl) {
      throw createHttpError(
        STATUS_CODE.BAD_REQUEST,
        'Payment proof screenshot is required for paid plans. Upload the payment success receipt — the plan activates after admin verification.',
      );
    }

    const hostelId = dto.hostelId || null;
    const pending = await this.subscriptionRepository.findPendingRequest(ownerId, hostelId);
    if (pending) {
      throw createHttpError(
        STATUS_CODE.CONFLICT,
        'A subscription request is already awaiting admin review. Please wait until it is approved or rejected.',
      );
    }

    const saved = await this.subscriptionRepository.save(
      this.subscriptionRepository.create({
        ownerId,
        hostelId,
        plan: dto.plan,
        status: SubscriptionStatus.PENDING,
        billingCycle: cycle,
        price: planDef.price,
        currency: planDef.currency,
        startDate: new Date(),
        endDate: null,
        autoRenew: false,
        paymentMethod: dto.paymentMethod ?? null,
        paymentReference: dto.paymentReference || null,
        notes: dto.notes || null,
        proofUrl,
        proofPublicId,
      }),
    );

    await this.bustSubscriptionCaches();
    return { subscription: saved, plan: planDef, requiresApproval: true };
  }

  private async bustSubscriptionCaches(): Promise<void> {
    await cacheService.invalidatePattern('subscription');
    await cacheService.invalidatePattern('owner');
  }

  /**
   * Admin review queue: PENDING (or status-filtered) payment requests with
   * owner/hostel names, proof screenshot and payment details.
   */
  public async listRequests(options: {
    status?: SubscriptionStatus | undefined;
    page: number;
    limit: number;
  }): Promise<PaginatedResponse<SerializedSubscriptionRequest>> {
    const { rows, total } = await this.subscriptionRepository.listRequests(options);
    return createPaginatedResponse(
      rows.map((row) => this.serializeRequest(row)),
      total,
      options,
    );
  }

  /**
   * Admin reviews a PENDING request (payment proof).
   * APPROVE → requested plan activates now; REJECT → marked REJECTED and the
   * owner stays on their current plan.
   */
  public async reviewRequest(
    actorId: string,
    role: string,
    requestId: string,
    dto: ReviewSubscriptionDto,
  ): Promise<{ subscription: Subscription; plan: SubscriptionPlanDefinition }> {
    if (role.toLowerCase() !== IROLES.ADMIN.toLowerCase()) {
      throw createHttpError(STATUS_CODE.FORBIDDEN, 'Only admins can review subscription requests');
    }

    const request = await this.subscriptionRepository.findById(requestId);
    if (!request) {
      throw createHttpError(STATUS_CODE.NOT_FOUND, 'Subscription request not found');
    }
    if (request.status !== SubscriptionStatus.PENDING) {
      throw createHttpError(STATUS_CODE.CONFLICT, 'Request has already been reviewed');
    }

    const planDef = getPlanDefinition(request.plan);
    const reviewedAt = new Date();
    request.reviewNote = dto.note?.trim() || null;
    request.reviewedBy = actorId;
    request.reviewedAt = reviewedAt;

    if (dto.action === SubscriptionReviewAction.REJECT) {
      request.status = SubscriptionStatus.REJECTED;
    } else {
      // Approve → requested plan becomes active, previous plan expires.
      await this.subscriptionRepository.deactivateExistingActive(request.ownerId, request.hostelId);

      const startDate = reviewedAt;
      const endDate = new Date(startDate);
      if (request.billingCycle === BillingCycle.YEARLY) {
        endDate.setFullYear(endDate.getFullYear() + 1);
      } else {
        endDate.setDate(endDate.getDate() + 30);
      }

      request.status = SubscriptionStatus.ACTIVE;
      request.startDate = startDate;
      request.endDate = request.plan === SubscriptionPlan.FREE ? null : endDate;
      request.price = planDef.price;
      request.currency = planDef.currency;
    }

    const saved = await this.subscriptionRepository.save(request);
    await this.bustSubscriptionCaches();

    return { subscription: saved, plan: planDef };
  }

  private serializeRequest(sub: Subscription): SerializedSubscriptionRequest {
    const owner = sub.owner as
      { firstName?: string; lastName?: string; email?: string } | undefined;
    const ownerName = `${owner?.firstName ?? ''} ${owner?.lastName ?? ''}`.trim() || 'Hostel Owner';

    return {
      id: sub.id,
      ownerId: sub.ownerId,
      ownerName,
      ownerEmail: owner?.email ?? undefined,
      hostelId: sub.hostelId,
      hostelName: sub.hostel?.name ?? undefined,
      plan: sub.plan,
      status: sub.status,
      billingCycle: sub.billingCycle,
      price: Number(sub.price),
      currency: sub.currency,
      paymentMethod: sub.paymentMethod ?? null,
      paymentReference: sub.paymentReference ?? null,
      notes: sub.notes ?? null,
      proofUrl: sub.proofUrl ?? null,
      reviewNote: sub.reviewNote ?? null,
      reviewedBy: sub.reviewedBy ?? null,
      reviewedAt:
        sub.reviewedAt instanceof Date ? sub.reviewedAt.toISOString() : (sub.reviewedAt ?? null),
      startDate:
        sub.startDate instanceof Date ? sub.startDate.toISOString() : String(sub.startDate),
      endDate:
        sub.endDate === null
          ? null
          : sub.endDate instanceof Date
            ? sub.endDate.toISOString()
            : String(sub.endDate),
      createdAt:
        sub.createdAt instanceof Date ? sub.createdAt.toISOString() : String(sub.createdAt),
    };
  }

  /**
   * Cancels the active subscription, reverting to the FREE plan.
   */
  public async cancelSubscription(ownerId: string, hostelId?: string | undefined): Promise<void> {
    await this.subscriptionRepository.deactivateExistingActive(ownerId, hostelId ?? null);
    await cacheService.invalidatePattern('subscription');
    await cacheService.invalidatePattern('owner');
  }

  /**
   * Retrieves subscription history for an owner.
   */
  public async getHistory(ownerId: string): Promise<Subscription[]> {
    return this.subscriptionRepository.findByOwner(ownerId);
  }

  /**
   * Enforces the resident limit according to the hostel's active plan.
   * Free: max 10 residents
   * Basic: max 60 residents
   * Pro: unlimited residents
   * Enterprise: unlimited residents
   */
  public async checkResidentLimit(
    hostelId: string,
    additionalCount = 1,
  ): Promise<ResidentLimitCheckResult> {
    const hostel = await this.subscriptionRepository.findHostelById(hostelId);
    const ownerId = hostel?.ownerId || undefined;

    const activeSub = await this.subscriptionRepository.findActiveSubscription({
      hostelId,
      ownerId,
    });

    const currentPlan = activeSub ? activeSub.plan : SubscriptionPlan.FREE;
    const planDef = getPlanDefinition(currentPlan);
    const currentCount = await this.subscriptionRepository.countActiveResidents(hostelId);
    const maxResidents = planDef.limits.maxResidents;

    if (maxResidents !== null && currentCount + additionalCount > maxResidents) {
      const upgradeSuggestion =
        currentPlan === SubscriptionPlan.FREE
          ? 'Upgrade to Basic (up to 60 residents) or Pro (unlimited residents).'
          : currentPlan === SubscriptionPlan.BASIC
            ? 'Upgrade to Pro for unlimited residents.'
            : 'Please upgrade your subscription.';

      return {
        allowed: false,
        currentPlan,
        planName: planDef.name,
        limit: maxResidents,
        currentCount,
        message: `Resident limit reached for ${planDef.name} plan (maximum ${maxResidents} residents, currently ${currentCount}). ${upgradeSuggestion}`,
      };
    }

    return {
      allowed: true,
      currentPlan,
      planName: planDef.name,
      limit: maxResidents,
      currentCount,
    };
  }

  /**
   * Enforces the hostel limit according to the owner's active plan.
   * Free / Basic / Pro: 1 hostel
   * Enterprise: Multiple hostels
   */
  public async checkHostelLimit(
    ownerId: string,
    additionalCount = 1,
  ): Promise<HostelLimitCheckResult> {
    const activeSub = await this.subscriptionRepository.findActiveSubscription({ ownerId });
    const currentPlan = activeSub ? activeSub.plan : SubscriptionPlan.FREE;
    const planDef = getPlanDefinition(currentPlan);
    const currentCount = await this.subscriptionRepository.countOwnerHostels(ownerId);
    const maxHostels = planDef.limits.maxHostels;

    if (maxHostels !== null && currentCount + additionalCount > maxHostels) {
      return {
        allowed: false,
        currentPlan,
        planName: planDef.name,
        limit: maxHostels,
        currentCount,
        message: `Hostel limit reached for ${planDef.name} plan (maximum ${maxHostels} hostel). Upgrade to Enterprise to manage multiple hostels.`,
      };
    }

    return {
      allowed: true,
      currentPlan,
      planName: planDef.name,
      limit: maxHostels,
      currentCount,
    };
  }
}
