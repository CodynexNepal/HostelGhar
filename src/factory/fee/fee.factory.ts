import { FeeController } from '../../controller/fee/fee.controller';
import { FeeRepository } from '../../repository/fee/fee.repository';
import { FeeService } from '../../services/fee/fee.service';

export class FeeFactory {
  private constructor() {}

  public static create(): FeeController {
    const feeRepository = new FeeRepository();
    const feeService = new FeeService(feeRepository);
    return new FeeController(feeService);
  }
}
