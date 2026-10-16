import { AttendanceController } from '../../controller/attendance/attendance.controller';
import { AttendanceRepository } from '../../repository/attendance/attendance.repository';
import { AttendanceService } from '../../services/attendance/attendance.service';

export class AttendanceFactory {
  private constructor() {}

  public static create(): AttendanceController {
    return new AttendanceController(new AttendanceService(new AttendanceRepository()));
  }
}
