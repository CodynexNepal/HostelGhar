import { PaymentProofController } from '../../controller/payment-proof/payment-proof.controller';
import { PaymentProofRepository } from '../../repository/payment-proof/payment-proof.repository';
import { PaymentProofService } from '../../services/payment-proof/payment-proof.service';

export class PaymentProofFactory {
  private constructor() {}

  public static create(): PaymentProofController {
    const repository = new PaymentProofRepository();
    const service = new PaymentProofService(repository);
    return new PaymentProofController(service);
  }
}
