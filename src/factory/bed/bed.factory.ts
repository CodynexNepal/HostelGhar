import { BedController } from '../../controller/bed/bed.controller';
import { BedRepository } from '../../repository/bed/bed.repository';
import { BedService } from '../../services/bed/bed.service';

export class BedFactory {
  private constructor() {}

  public static create(): BedController {
    const bedRepository = new BedRepository();
    const bedService = new BedService(bedRepository);
    return new BedController(bedService);
  }
}
