import { Repository } from 'typeorm';
import { AppDataSource } from '../../database/database-source';
import {
  HostelListingRequest,
  ListingRequestStatus,
} from '../../entities/hostel-listing/hostel-listing-request.entity';
import { logger } from '../../observability/logger';

export interface CreateListingRequestDTO {
  hostelName: string;
  type: string;
  totalBeds: number;
  phone: string;
  city: string;
  area?: string | null;
  address: string;
  priceFrom?: number | null;
  negotiable?: boolean;
  amenities?: string[];
  description?: string | null;
  rules?: string | null;
  photos?: string[];
  ownerName: string;
  email: string;
  ipAddress?: string | null;
}

export class HostelListingService {
  private repo: Repository<HostelListingRequest>;

  constructor() {
    this.repo = AppDataSource.getRepository(HostelListingRequest);
  }

  public async submitListingRequest(data: CreateListingRequestDTO): Promise<HostelListingRequest> {
    const listing = this.repo.create({
      hostelName: data.hostelName.trim(),
      type: data.type || 'coed',
      totalBeds: Number(data.totalBeds) || 0,
      phone: data.phone.trim(),
      city: data.city.trim(),
      area: data.area?.trim() || null,
      address: data.address.trim(),
      priceFrom: data.priceFrom ? Number(data.priceFrom) : null,
      negotiable: Boolean(data.negotiable),
      amenities: Array.isArray(data.amenities) ? data.amenities : [],
      description: data.description?.trim() || null,
      rules: data.rules?.trim() || null,
      photos: Array.isArray(data.photos) ? data.photos : [],
      ownerName: data.ownerName.trim(),
      email: data.email.trim().toLowerCase(),
      status: ListingRequestStatus.PENDING,
      ipAddress: data.ipAddress || null,
    });

    const saved = await this.repo.save(listing);
    logger.info('New hostel listing application submitted', {
      id: saved.id,
      hostelName: saved.hostelName,
      ownerEmail: saved.email,
    });
    return saved;
  }

  public async listRequests(page: number = 1, limit: number = 20) {
    const [requests, total] = await this.repo.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { requests, total, page, limit };
  }

  public async updateStatus(
    id: string,
    status: ListingRequestStatus,
    adminNotes?: string,
  ): Promise<HostelListingRequest | null> {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) return null;
    item.status = status;
    if (adminNotes !== undefined) item.adminNotes = adminNotes;
    return this.repo.save(item);
  }

  public async deleteRequest(id: string): Promise<boolean> {
    const res = await this.repo.delete({ id });
    return (res.affected ?? 0) > 0;
  }
}
