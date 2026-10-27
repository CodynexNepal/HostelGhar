"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: subscription.enum.ts
// PURPOSE: Enums for subscription plans, status, and billing cycles.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingCycle = exports.SubscriptionReviewAction = exports.SubscriptionStatus = exports.SubscriptionPlan = void 0;
var SubscriptionPlan;
(function (SubscriptionPlan) {
    SubscriptionPlan["FREE"] = "FREE";
    SubscriptionPlan["BASIC"] = "BASIC";
    SubscriptionPlan["PRO"] = "PRO";
    SubscriptionPlan["ENTERPRISE"] = "ENTERPRISE";
})(SubscriptionPlan || (exports.SubscriptionPlan = SubscriptionPlan = {}));
var SubscriptionStatus;
(function (SubscriptionStatus) {
    SubscriptionStatus["ACTIVE"] = "ACTIVE";
    SubscriptionStatus["EXPIRED"] = "EXPIRED";
    SubscriptionStatus["CANCELLED"] = "CANCELLED";
    SubscriptionStatus["PENDING"] = "PENDING";
    SubscriptionStatus["REJECTED"] = "REJECTED";
})(SubscriptionStatus || (exports.SubscriptionStatus = SubscriptionStatus = {}));
/**
 * Admin action on a PENDING subscription request (payment proof review).
 * PATCH/POST `subscriptions/requests/:id/review`.
 */
var SubscriptionReviewAction;
(function (SubscriptionReviewAction) {
    SubscriptionReviewAction["APPROVE"] = "APPROVE";
    SubscriptionReviewAction["REJECT"] = "REJECT";
})(SubscriptionReviewAction || (exports.SubscriptionReviewAction = SubscriptionReviewAction = {}));
var BillingCycle;
(function (BillingCycle) {
    BillingCycle["MONTHLY"] = "MONTHLY";
    BillingCycle["YEARLY"] = "YEARLY";
})(BillingCycle || (exports.BillingCycle = BillingCycle = {}));
