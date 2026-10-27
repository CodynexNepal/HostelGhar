"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: subscription.controller.ts
// PURPOSE: HTTP handlers for subscription plans, current tier status, and upgrades.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionController = void 0;
const statusCode_interface_1 = require("../../constant/statusCode.interface");
const message_interface_1 = require("../../constant/message.interface");
const subscription_enum_1 = require("../../enum/subscription.enum");
const upload_middleware_1 = require("../../middleware/upload.middleware");
const pagination_util_1 = require("../../utils/pagination.util");
const http_decorator_1 = require("../../decorators/http.decorator");
class SubscriptionController {
    constructor(subscriptionService) {
        this.subscriptionService = subscriptionService;
        /**
         * GET /subscriptions/plans
         * Public or authenticated: Lists all subscription tiers with features, pricing, limits, and CTAs.
         */
        this.getPlans = async (req, res, next) => {
            try {
                let currentPlan;
                if (req.user?.userId) {
                    const currentSub = await this.subscriptionService.getCurrentSubscription({
                        ownerId: req.user.userId,
                        hostelId: req.hostelId ?? undefined,
                    });
                    currentPlan = currentSub.plan.id;
                }
                const plans = this.subscriptionService.getAllPlans(currentPlan);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    message: message_interface_1.MESSAGES.SUBSCRIPTION_PLANS_FETCHED,
                    data: plans,
                });
            }
            catch (error) {
                next(error);
            }
        };
        /**
         * GET /subscriptions/current
         * Returns the logged-in owner's current subscription, features, limits, and live usage.
         */
        this.getCurrentSubscription = async (req, res, next) => {
            try {
                const ownerId = req.user.userId;
                const hostelId = req.hostelId || req.query.hostelId;
                const result = await this.subscriptionService.getCurrentSubscription({
                    ownerId,
                    hostelId: hostelId ?? undefined,
                });
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    message: message_interface_1.MESSAGES.SUBSCRIPTION_CURRENT_FETCHED,
                    data: result,
                });
            }
            catch (error) {
                next(error);
            }
        };
        /**
         * POST /subscriptions/subscribe
         * Requests a plan change (FREE = instant downgrade; BASIC/PRO/ENTERPRISE =
         * owner uploads a payment proof → PENDING until an admin approves it).
         */
        this.subscribe = async (req, res, next) => {
            try {
                const ownerId = req.user.userId;
                const dto = req.body;
                if (!dto.hostelId && req.hostelId) {
                    dto.hostelId = req.hostelId;
                }
                const file = (0, upload_middleware_1.pickSubscriptionProofFile)(req);
                const result = await this.subscriptionService.subscribe(ownerId, dto, file);
                res.status(result.requiresApproval ? statusCode_interface_1.STATUS_CODE.CREATED : statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    message: result.requiresApproval
                        ? `Payment proof submitted for ${result.plan.name} plan. Your subscription changes after admin verification.`
                        : `Successfully subscribed to ${result.plan.name} plan`,
                    data: {
                        subscription: result.subscription,
                        plan: result.plan,
                        requiresApproval: result.requiresApproval,
                    },
                });
            }
            catch (error) {
                next(error);
            }
        };
        /**
         * GET /subscriptions/requests
         * Admin: review queue of owner payment-proof requests (default PENDING).
         */
        this.getRequests = async (req, res, next) => {
            try {
                const { page, limit } = (0, pagination_util_1.normalizePagination)({
                    page: req.query.page,
                    limit: req.query.limit,
                });
                const raw = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : 'PENDING';
                const isKnown = Object.values(subscription_enum_1.SubscriptionStatus).includes(raw);
                const status = isKnown ? raw : subscription_enum_1.SubscriptionStatus.PENDING;
                const result = await this.subscriptionService.listRequests({ status, page, limit });
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({ success: true, ...result });
            }
            catch (error) {
                next(error);
            }
        };
        /**
         * POST /subscriptions/requests/:id/review
         * Admin: APPROVE (activates the plan) or REJECT (owner keeps current plan).
         */
        this.reviewRequest = async (req, res, next) => {
            try {
                const id = (0, http_decorator_1.getRequiredParam)(req, 'id');
                const dto = req.body;
                const result = await this.subscriptionService.reviewRequest(req.user.userId, req.user.role, id, dto);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    message: dto.action === subscription_enum_1.SubscriptionReviewAction.APPROVE
                        ? `Subscription approved — ${result.plan.name} plan is now active.`
                        : 'Subscription request rejected. The owner stays on their current plan.',
                    data: result,
                });
            }
            catch (error) {
                next(error);
            }
        };
        /**
         * POST /subscriptions/cancel
         * Cancels the active subscription and reverts back to the FREE plan.
         */
        this.cancel = async (req, res, next) => {
            try {
                const ownerId = req.user.userId;
                const hostelId = req.hostelId || req.body.hostelId;
                await this.subscriptionService.cancelSubscription(ownerId, hostelId);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    message: message_interface_1.MESSAGES.SUBSCRIPTION_CANCELLED,
                });
            }
            catch (error) {
                next(error);
            }
        };
        /**
         * GET /subscriptions/history
         * Returns past and active subscription records.
         */
        this.getHistory = async (req, res, next) => {
            try {
                const ownerId = req.user.userId;
                const history = await this.subscriptionService.getHistory(ownerId);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    message: message_interface_1.MESSAGES.SUBSCRIPTION_HISTORY_FETCHED,
                    data: history,
                });
            }
            catch (error) {
                next(error);
            }
        };
        /**
         * GET /subscriptions/check-limit
         * Checks if current hostel has capacity to add more residents under current plan.
         */
        this.checkResidentLimit = async (req, res, next) => {
            try {
                const hostelId = req.hostelId || req.query.hostelId;
                if (!hostelId) {
                    res.status(statusCode_interface_1.STATUS_CODE.BAD_REQUEST).json({
                        success: false,
                        message: 'hostelId is required',
                    });
                    return;
                }
                const count = req.query.count ? parseInt(req.query.count, 10) : 1;
                const result = await this.subscriptionService.checkResidentLimit(hostelId, count);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    data: result,
                });
            }
            catch (error) {
                next(error);
            }
        };
    }
}
exports.SubscriptionController = SubscriptionController;
