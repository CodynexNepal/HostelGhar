"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OwnerFactory = void 0;
const owner_controller_1 = require("../../controller/owner/owner.controller");
const owner_repository_1 = require("../../repository/owner/owner.repository");
const subscription_factory_1 = require("../subscription/subscription.factory");
class OwnerFactory {
    constructor() { }
    static create() {
        const ownerRepository = new owner_repository_1.OwnerRepository();
        const subscriptionService = subscription_factory_1.SubscriptionFactory.createService();
        return new owner_controller_1.OwnerController(ownerRepository, subscriptionService);
    }
}
exports.OwnerFactory = OwnerFactory;
