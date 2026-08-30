import { AdminRepository } from '../../repository/admin/admin.repository';
export class AdminServices {
  constructor(private readonly adminRepository: AdminRepository) {}

  async createLeaveType(): Promise<void> {}
}
