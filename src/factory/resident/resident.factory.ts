import { ResidentController } from '../../controller/resident/resident.controller';
import { ResidentRepository } from '../../repository/resident/resident.repository';

export class ResidentFactory {
  private constructor() {}

  public static create(): ResidentController {
    const residentRepository = new ResidentRepository();
    return new ResidentController(residentRepository);
  }
}
