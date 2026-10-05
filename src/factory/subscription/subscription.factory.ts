// ──────────────────────────────────────────────────────────────────────────────
// FILE: subscription.factory.ts
// PURPOSE: Dependency composition for Subscription repository, service, and controller.
// ──────────────────────────────────────────────────────────────────────────────

import { SubscriptionController } from '../../controller/subscription/subscription.controller';
import { SubscriptionRepository } from '../../repository/subscription/subscription.repository';
import { SubscriptionService } from '../../services/subscription/subscription.service';

export class SubscriptionFactory {
  private constructor() {}

  public static createService(): SubscriptionService {
    const repository = new SubscriptionRepository();
    return new SubscriptionService(repository);
  }

  public static create(): SubscriptionController {
    const service = SubscriptionFactory.createService();
    return new SubscriptionController(service);
  }
}
