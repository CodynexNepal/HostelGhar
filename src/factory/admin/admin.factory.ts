import { AdminController } from '../../controller/admin/admin.controller';
import { AdminRepository } from '../../repository/admin/admin.repository';
import { AdminService } from '../../services/admin/admin.services';

export class AdminFactory {
  private constructor() {}

  public static create(): AdminController {
    const adminRepository = new AdminRepository();
    const adminService = new AdminService(adminRepository);
    return new AdminController(adminService);
  }
}
