import { AdminController } from '../../controller/admin/admin.controller';
import { AdminRepository } from '../../repository/admin/admin.repository';

export class AdminFactory {
  private constructor() {}

  public static create(): AdminController {
    const adminRepository = new AdminRepository();
    return new AdminController(adminRepository);
  }
}
