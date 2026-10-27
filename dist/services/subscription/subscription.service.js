"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: subscription.service.ts
// PURPOSE: Business logic for plans, upgrades, limits, and subscription lifecycle.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionService = void 0;
const subscription_constant_1 = require("../../constant/subscription.constant");
const subscription_enum_1 = require("../../enum/subscription.enum");
const cache_util_1 = require("../../utils/cache.util");
const statusCode_interface_1 = require("../../constant/statusCode.interface");
const roles_enum_1 = require("../../enum/roles.enum");
const createHttpError_1 = require("../../utils/createHttpError");
const image_upload_service_1 = require("../upload/image-upload.service");
const pagination_util_1 = require("../../utils/pagination.util");
class SubscriptionService {
    constructor(subscriptionRepository) {
        this.subscriptionRepository = subscriptionRepository;
    }
    /**
     * Returns all available subscription plans with complete feature lists,
     * pricing, limits, and dynamic current-plan indicator.
     */
    getAllPlans(currentPlan) {
        const activePlan = currentPlan || subscription_enum_1.SubscriptionPlan.FREE;
        return Object.values(subscription_constant_1.SUBSCRIPTION_PLANS).map((plan) => {
            const isCurrent = plan.id === activePlan;
            return {
                ...plan,
                isCurrent,
                buttonText: isCurrent
                    ? plan.id === subscription_enum_1.SubscriptionPlan.FREE
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
    async getCurrentSubscription(params) {
        const activeSub = await this.subscriptionRepository.findActiveSubscription(params);
        const planId = activeSub ? activeSub.plan : subscription_enum_1.SubscriptionPlan.FREE;
        const planDef = (0, subscription_constant_1.getPlanDefinition)(planId);
        // Calculate usage metrics
        const residentCount = params.hostelId
            ? await this.subscriptionRepository.countActiveResidents(params.hostelId)
            : 0;
        const hostelCount = await this.subscriptionRepository.countOwnerHostels(params.ownerId);
        const residentLimit = planDef.limits.maxResidents;
        const residentLimitReached = residentLimit !== null ? residentCount >= residentLimit : false;
        const hostelLimit = planDef.limits.maxHostels;
        const hostelLimitReached = hostelLimit !== null ? hostelCount >= hostelLimit : false;
        let daysRemaining = null;
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
    async subscribe(ownerId, dto, file) {
        const planDef = (0, subscription_constant_1.getPlanDefinition)(dto.plan);
        const cycle = dto.billingCycle || subscription_enum_1.BillingCycle.MONTHLY;
        // ── FREE: downgrade only, nothing to verify → instant ───────────────────
        if (dto.plan === subscription_enum_1.SubscriptionPlan.FREE) {
            await this.subscriptionRepository.deactivateExistingActive(ownerId, dto.hostelId);
            const saved = await this.subscriptionRepository.save(this.subscriptionRepository.create({
                ownerId,
                hostelId: dto.hostelId || null,
                plan: subscription_enum_1.SubscriptionPlan.FREE,
                status: subscription_enum_1.SubscriptionStatus.ACTIVE,
                billingCycle: cycle,
                price: 0,
                currency: planDef.currency,
                startDate: new Date(),
                endDate: null,
                autoRenew: false,
                paymentReference: dto.paymentReference || null,
                notes: dto.notes || null,
            }));
            await this.bustSubscriptionCaches();
            return { subscription: saved, plan: planDef, requiresApproval: false };
        }
        // ── Paid plans: payment proof + admin approval required ─────────────────
        let proofUrl = dto.proofUrl?.trim() || null;
        let proofPublicId = null;
        if (file?.buffer) {
            const uploaded = await image_upload_service_1.imageUploadService.uploadSubscriptionProofScreenshot(file, ownerId);
            proofUrl = uploaded.url;
            proofPublicId = uploaded.publicId;
        }
        if (!proofUrl) {
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.BAD_REQUEST, 'Payment proof screenshot is required for paid plans. Upload the payment success receipt — the plan activates after admin verification.');
        }
        const hostelId = dto.hostelId || null;
        const pending = await this.subscriptionRepository.findPendingRequest(ownerId, hostelId);
        if (pending) {
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.CONFLICT, 'A subscription request is already awaiting admin review. Please wait until it is approved or rejected.');
        }
        const saved = await this.subscriptionRepository.save(this.subscriptionRepository.create({
            ownerId,
            hostelId,
            plan: dto.plan,
            status: subscription_enum_1.SubscriptionStatus.PENDING,
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
        }));
        await this.bustSubscriptionCaches();
        return { subscription: saved, plan: planDef, requiresApproval: true };
    }
    async bustSubscriptionCaches() {
        await cache_util_1.cacheService.invalidatePattern('subscription');
        await cache_util_1.cacheService.invalidatePattern('owner');
    }
    /**
     * Admin review queue: PENDING (or status-filtered) payment requests with
     * owner/hostel names, proof screenshot and payment details.
     */
    async listRequests(options) {
        const { rows, total } = await this.subscriptionRepository.listRequests(options);
        return (0, pagination_util_1.createPaginatedResponse)(rows.map((row) => this.serializeRequest(row)), total, options);
    }
    /**
     * Admin reviews a PENDING request (payment proof).
     * APPROVE → requested plan activates now; REJECT → marked REJECTED and the
     * owner stays on their current plan.
     */
    async reviewRequest(actorId, role, requestId, dto) {
        if (role.toLowerCase() !== roles_enum_1.IROLES.ADMIN.toLowerCase()) {
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.FORBIDDEN, 'Only admins can review subscription requests');
        }
        const request = await this.subscriptionRepository.findById(requestId);
        if (!request) {
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.NOT_FOUND, 'Subscription request not found');
        }
        if (request.status !== subscription_enum_1.SubscriptionStatus.PENDING) {
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.CONFLICT, 'Request has already been reviewed');
        }
        const planDef = (0, subscription_constant_1.getPlanDefinition)(request.plan);
        const reviewedAt = new Date();
        request.reviewNote = dto.note?.trim() || null;
        request.reviewedBy = actorId;
        request.reviewedAt = reviewedAt;
        if (dto.action === subscription_enum_1.SubscriptionReviewAction.REJECT) {
            request.status = subscription_enum_1.SubscriptionStatus.REJECTED;
        }
        else {
            // Approve → requested plan becomes active, previous plan expires.
            await this.subscriptionRepository.deactivateExistingActive(request.ownerId, request.hostelId);
            const startDate = reviewedAt;
            const endDate = new Date(startDate);
            if (request.billingCycle === subscription_enum_1.BillingCycle.YEARLY) {
                endDate.setFullYear(endDate.getFullYear() + 1);
            }
            else {
                endDate.setDate(endDate.getDate() + 30);
            }
            request.status = subscription_enum_1.SubscriptionStatus.ACTIVE;
            request.startDate = startDate;
            request.endDate = request.plan === subscription_enum_1.SubscriptionPlan.FREE ? null : endDate;
            request.price = planDef.price;
            request.currency = planDef.currency;
        }
        const saved = await this.subscriptionRepository.save(request);
        await this.bustSubscriptionCaches();
        return { subscription: saved, plan: planDef };
    }
    serializeRequest(sub) {
        const owner = sub.owner;
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
            reviewedAt: sub.reviewedAt instanceof Date ? sub.reviewedAt.toISOString() : (sub.reviewedAt ?? null),
            startDate: sub.startDate instanceof Date ? sub.startDate.toISOString() : String(sub.startDate),
            endDate: sub.endDate === null
                ? null
                : sub.endDate instanceof Date
                    ? sub.endDate.toISOString()
                    : String(sub.endDate),
            createdAt: sub.createdAt instanceof Date ? sub.createdAt.toISOString() : String(sub.createdAt),
        };
    }
    /**
     * Cancels the active subscription, reverting to the FREE plan.
     */
    async cancelSubscription(ownerId, hostelId) {
        await this.subscriptionRepository.deactivateExistingActive(ownerId, hostelId ?? null);
        await cache_util_1.cacheService.invalidatePattern('subscription');
        await cache_util_1.cacheService.invalidatePattern('owner');
    }
    /**
     * Retrieves subscription history for an owner.
     */
    async getHistory(ownerId) {
        return this.subscriptionRepository.findByOwner(ownerId);
    }
    /**
     * Enforces the resident limit according to the hostel's active plan.
     * Free: max 10 residents
     * Basic: max 60 residents
     * Pro: unlimited residents
     * Enterprise: unlimited residents
     */
    async checkResidentLimit(hostelId, additionalCount = 1) {
        const hostel = await this.subscriptionRepository.findHostelById(hostelId);
        const ownerId = hostel?.ownerId || undefined;
        const activeSub = await this.subscriptionRepository.findActiveSubscription({
            hostelId,
            ownerId,
        });
        const currentPlan = activeSub ? activeSub.plan : subscription_enum_1.SubscriptionPlan.FREE;
        const planDef = (0, subscription_constant_1.getPlanDefinition)(currentPlan);
        const currentCount = await this.subscriptionRepository.countActiveResidents(hostelId);
        const maxResidents = planDef.limits.maxResidents;
        if (maxResidents !== null && currentCount + additionalCount > maxResidents) {
            const upgradeSuggestion = currentPlan === subscription_enum_1.SubscriptionPlan.FREE
                ? 'Upgrade to Basic (up to 60 residents) or Pro (unlimited residents).'
                : currentPlan === subscription_enum_1.SubscriptionPlan.BASIC
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
    async checkHostelLimit(ownerId, additionalCount = 1) {
        const activeSub = await this.subscriptionRepository.findActiveSubscription({ ownerId });
        const currentPlan = activeSub ? activeSub.plan : subscription_enum_1.SubscriptionPlan.FREE;
        const planDef = (0, subscription_constant_1.getPlanDefinition)(currentPlan);
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
exports.SubscriptionService = SubscriptionService;
