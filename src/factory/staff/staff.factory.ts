import { StaffController } from '../../controller/staff/staff.controller';
import { StaffRepository } from '../../repository/staff/staff.repository';
import { StaffService } from '../../services/staff/staff.service';

export class StaffFactory {
  private constructor() {}

  public static create(): StaffController {
    return new StaffController(new StaffService(new StaffRepository()));
  }
}
