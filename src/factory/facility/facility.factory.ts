import { FacilityController } from '../../controller/facility/facility.controller';
import { FacilityRepository } from '../../repository/facility/facility.repository';
import { FacilityService } from '../../services/facility/facility.service';

export class FacilityFactory {
  private constructor() {}
  public static create(): FacilityController {
    const repo = new FacilityRepository();
    const service = new FacilityService(repo);
    return new FacilityController(service);
  }
}
