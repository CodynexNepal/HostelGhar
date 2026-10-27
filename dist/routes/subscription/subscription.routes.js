"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: subscription.routes.ts
// PURPOSE: Routes for subscription plans, current tier status, upgrades, and limits.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscriptionRouter = void 0;
const express_1 = require("express");
const subscription_factory_1 = require("../../factory/subscription/subscription.factory");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const roles_enum_1 = require("../../enum/roles.enum");
const validate_dto_middleware_1 = require("../../middleware/validate-dto.middleware");
const subscribe_dto_1 = require("../../dto/subscription/subscribe.dto");
const review_subscription_dto_1 = require("../../dto/subscription/review-subscription.dto");
const hostel_context_middleware_1 = require("../../middleware/hostel-context.middleware");
const upload_middleware_1 = require("../../middleware/upload.middleware");
const http_decorator_1 = require("../../decorators/http.decorator");
const jwt_token_util_1 = require("../../utils/jwt-token.util");
const subscriptionRouter = (0, express_1.Router)();
exports.subscriptionRouter = subscriptionRouter;
const subscriptionController = subscription_factory_1.SubscriptionFactory.create();
/**
 * Optional authentication middleware for public/hybrid endpoints like /plans
 */
const optionalAuthenticate = (req, _res, next) => {
    const authHeader = req.headers.authorization;
    let token;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    }
    else if (req.cookies?.access_token) {
        token = req.cookies.access_token;
    }
    if (token) {
        try {
            const payload = jwt_token_util_1.JwtTokenService.verifyAccessToken(token);
            if (payload) {
                req.user = payload;
            }
        }
        catch {
            // Ignore invalid token on optional auth endpoints
        }
    }
    next();
};
// Public/Optional Auth: View all subscription plans with features & pricing
subscriptionRouter.get('/plans', optionalAuthenticate, subscriptionController.getPlans);
// Protected routes (Owner & Admin)
subscriptionRouter.get('/current', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRoles)(roles_enum_1.IROLES.OWNER, roles_enum_1.IROLES.ADMIN), hostel_context_middleware_1.resolveHostelId, subscriptionController.getCurrentSubscription);
subscriptionRouter.post('/subscribe', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRoles)(roles_enum_1.IROLES.OWNER, roles_enum_1.IROLES.ADMIN), 
// Multipart must run BEFORE resolveHostelId so `hostelId` sent as a form
// field is already parsed into req.body; JSON bodies pass straight through.
upload_middleware_1.uploadSubscriptionProof, (0, upload_middleware_1.stripFileFields)('proof', 'screenshot', 'receipt', 'image', 'file'), hostel_context_middleware_1.resolveHostelId, (0, validate_dto_middleware_1.validateDto)(subscribe_dto_1.SubscribeDto), subscriptionController.subscribe);
// Admin review queue: owner payment proofs awaiting approval
subscriptionRouter.get('/requests', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRoles)(roles_enum_1.IROLES.ADMIN), subscriptionController.getRequests);
// Admin approves (activates) or rejects a PENDING subscription request
subscriptionRouter.post('/requests/:id/review', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRoles)(roles_enum_1.IROLES.ADMIN), (0, http_decorator_1.requireParam)('id'), (0, validate_dto_middleware_1.validateDto)(review_subscription_dto_1.ReviewSubscriptionDto), subscriptionController.reviewRequest);
subscriptionRouter.post('/cancel', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRoles)(roles_enum_1.IROLES.OWNER, roles_enum_1.IROLES.ADMIN), hostel_context_middleware_1.resolveHostelId, subscriptionController.cancel);
subscriptionRouter.get('/history', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRoles)(roles_enum_1.IROLES.OWNER, roles_enum_1.IROLES.ADMIN), subscriptionController.getHistory);
subscriptionRouter.get('/check-limit', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRoles)(roles_enum_1.IROLES.OWNER, roles_enum_1.IROLES.ADMIN), hostel_context_middleware_1.resolveHostelId, subscriptionController.checkResidentLimit);
