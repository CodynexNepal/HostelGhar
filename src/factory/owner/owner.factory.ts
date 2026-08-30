import { OwnerController } from '../../controller/owner/owner.controller';
import { OwnerRepository } from '../../repository/owner/owner.repository';

export class OwnerFactory {
  private constructor() {}

  public static create(): OwnerController {
    const ownerRepository = new OwnerRepository();
    return new OwnerController(ownerRepository);
  }
}
