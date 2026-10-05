import { OwnerController } from '../../controller/owner/owner.controller';
import { OwnerRepository } from '../../repository/owner/owner.repository';
import { SubscriptionFactory } from '../subscription/subscription.factory';

export class OwnerFactory {
  private constructor() {}

  public static create(): OwnerController {
    const ownerRepository = new OwnerRepository();
    const subscriptionService = SubscriptionFactory.createService();
    return new OwnerController(ownerRepository, subscriptionService);
  }
}
