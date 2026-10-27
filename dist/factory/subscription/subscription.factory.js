"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: subscription.factory.ts
// PURPOSE: Dependency composition for Subscription repository, service, and controller.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionFactory = void 0;
const subscription_controller_1 = require("../../controller/subscription/subscription.controller");
const subscription_repository_1 = require("../../repository/subscription/subscription.repository");
const subscription_service_1 = require("../../services/subscription/subscription.service");
class SubscriptionFactory {
    constructor() { }
    static createService() {
        const repository = new subscription_repository_1.SubscriptionRepository();
        return new subscription_service_1.SubscriptionService(repository);
    }
    static create() {
        const service = SubscriptionFactory.createService();
        return new subscription_controller_1.SubscriptionController(service);
    }
}
exports.SubscriptionFactory = SubscriptionFactory;
