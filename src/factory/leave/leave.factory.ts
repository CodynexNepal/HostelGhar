import { LeaveController } from '../../controller/leave/leave.controller';
import { LeaveRepository } from '../../repository/leave/leave.repository';
import { LeaveService } from '../../services/leave/leave.service';

export class LeaveFactory {
  private constructor() {}

  public static create(): LeaveController {
    const leaveRepository = new LeaveRepository();
    const leaveService = new LeaveService(leaveRepository);
    return new LeaveController(leaveService);
  }
}
