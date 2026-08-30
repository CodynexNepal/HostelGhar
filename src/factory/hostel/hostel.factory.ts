import { HostelController } from '../../controller/hostel/hostel.controller';
import { HostelRepository } from '../../repository/hostel/hostel.repository';
import { HostelService } from '../../services/hostel/hostel.service';

export class HostelFactory {
  private constructor() {}

  public static create(): HostelController {
    const hostelRepository = new HostelRepository();
    const hostelService = new HostelService(hostelRepository);
    return new HostelController(hostelService);
  }
}
