import { HostelRepository } from '../../repository/hostel/hostel.repository';
import { STATUS_CODE } from '../../constant/statusCode.interface';

export class HostelService {
  constructor(private readonly hostelRepository: HostelRepository) {}

  public async listHostels(page: number, limit: number) {
    const [hostels, total] = await this.hostelRepository.findAll(page, limit);
    return {
      hostels,
      pagination: {
        totalItems: total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        itemsPerPage: limit,
      },
    };
  }

  public async getHostel(id: string) {
    const hostel = await this.hostelRepository.findById(id);
    if (!hostel) {
      return { error: { status: STATUS_CODE.NOT_FOUND, message: 'Hostel not found' } };
    }
    return { data: hostel };
  }

  public async getHostelResidents(id: string) {
    return { data: await this.hostelRepository.findResidents(id) };
  }

  public async getHostelLeaveTypes(id: string) {
    return { data: await this.hostelRepository.findLeaveTypes(id) };
  }
}
