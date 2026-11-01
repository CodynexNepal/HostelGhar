"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: subscription.middleware.ts
// PURPOSE: Middleware for enforcing subscription plan limits and feature access.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePlanFeature = void 0;
const roles_enum_1 = require("../enum/roles.enum");
const statusCode_interface_1 = require("../constant/statusCode.interface");
const subscription_factory_1 = require("../factory/subscription/subscription.factory");
const subscriptionService = subscription_factory_1.SubscriptionFactory.createService();
/**
 * Middleware that verifies if the current user (owner) has access to a specific subscription feature.
 * Admin users automatically bypass this check.
 */
const requirePlanFeature = (feature) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                res.status(statusCode_interface_1.STATUS_CODE.UNAUTHORIZED).json({
                    success: false,
                    message: 'Authentication required',
                });
                return;
            }
            // Admins bypass subscription feature restrictions
            if (req.user.role?.toUpperCase() === roles_enum_1.IROLES.ADMIN.toUpperCase()) {
                next();
                return;
            }
            // Owners are restricted by subscription tier
            if (req.user.role?.toUpperCase() === roles_enum_1.IROLES.OWNER.toUpperCase()) {
                const ownerId = req.user.userId;
                const hostelId = req.hostelId ||
                    (typeof req.query?.hostelId === 'string' ? req.query.hostelId : undefined) ||
                    (typeof req.body?.hostelId === 'string' ? req.body.hostelId : undefined);
                const check = await subscriptionService.checkFeatureAccess(ownerId, feature, hostelId);
                if (!check.allowed) {
                    res.status(statusCode_interface_1.STATUS_CODE.FORBIDDEN).json({
                        success: false,
                        message: check.message,
                        feature,
                        currentPlan: check.currentPlan,
                    });
                    return;
                }
            }
            next();
        }
        catch (error) {
            next(error);
        }
    };
};
exports.requirePlanFeature = requirePlanFeature;
