import { In, Repository } from 'typeorm';
import { AppDataSource } from '../../database/database-source';
import { Hostel } from '../../entities/hostel/hostel.entity';
import { Resident } from '../../entities/resident/resident.entity';
import { LeaveType } from '../../entities/leave/leave-type.entity';
import { Fee } from '../../entities/fee/fee.entity';
import { Room } from '../../entities/room/room.entity';
import { HostelRating } from '../../entities/rating/hostel-rating.entity';

export class HostelRepository {
  private readonly hostelRepo: Repository<Hostel>;
  private readonly residentRepo: Repository<Resident>;
  private readonly leaveTypeRepo: Repository<LeaveType>;
  private readonly feeRepo: Repository<Fee>;
  private readonly roomRepo: Repository<Room>;
  private readonly ratingRepo: Repository<HostelRating>;

  constructor() {
    this.hostelRepo = AppDataSource.getRepository(Hostel);
    this.residentRepo = AppDataSource.getRepository(Resident);
    this.leaveTypeRepo = AppDataSource.getRepository(LeaveType);
    this.feeRepo = AppDataSource.getRepository(Fee);
    this.roomRepo = AppDataSource.getRepository(Room);
    this.ratingRepo = AppDataSource.getRepository(HostelRating);
  }

  public async findAll(page: number, limit: number): Promise<[Hostel[], number]> {
    return this.hostelRepo.findAndCount({
      where: { isActive: true },
      relations: { owner: true },
      select: {
        id: true,
        name: true,
        type: true,
        city: true,
        address: true,
        phone: true,
        email: true,
        logoUrl: true,
        isActive: true,
        createdAt: true,
        owner: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          avatarUrl: true,
        },
      },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  public async findById(id: string): Promise<Hostel | null> {
    return this.hostelRepo.findOne({
      where: { id },
      relations: {
        owner: true,
        createdByAdmin: true,
        hostelFacilities: { facility: true },
      },
      select: {
        id: true,
        name: true,
        type: true,
        city: true,
        address: true,
        phone: true,
        email: true,
        logoUrl: true,
        isActive: true,
        owner: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          avatarUrl: true,
        },
        createdByAdmin: { id: true, firstName: true, lastName: true, email: true },
        hostelFacilities: {
          id: true,
          hostelId: true,
          facilityId: true,
          description: true,
          tag: true,
          clientKey: true,
          createdAt: true,
          updatedAt: true,
          facility: { id: true, title: true, slug: true },
        },
      },
      order: { hostelFacilities: { createdAt: 'ASC' } },
    });
  }

  public async findHostelOwner(hostelId: string): Promise<Pick<Hostel, 'id' | 'ownerId'> | null> {
    return this.hostelRepo.findOne({
      where: { id: hostelId },
      select: { id: true, ownerId: true },
    });
  }

  public async findResidentInHostel(hostelId: string, userId: string): Promise<Resident | null> {
    return this.residentRepo.findOne({
      where: { hostelId, userId, isActive: true },
      relations: { user: true, hostel: true },
      select: {
        id: true,
        hostelId: true,
        photoUrl: true,
        monthlyRent: true,
        createdAt: true,
        roomNumber: true,
        bedNumber: true,
        user: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          avatarUrl: true,
        },
        hostel: {
          id: true,
          name: true,
          type: true,
          city: true,
          address: true,
        },
      },
    });
  }

  public async findResidents(hostelId: string): Promise<Resident[]> {
    // Slim projection: only columns needed for the public resident list.
    // NEVER return password / refreshToken / reset tokens to the client.
    // Includes hostel join so the response can say WHICH hostel each resident lives in.
    return this.residentRepo.find({
      where: { hostelId, isActive: true },
      relations: { user: true, hostel: true },
      select: {
        id: true,
        hostelId: true,
        photoUrl: true,
        monthlyRent: true,
        createdAt: true,
        roomNumber: true,
        bedNumber: true,
        user: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          avatarUrl: true,
        },
        hostel: {
          id: true,
          name: true,
          type: true,
          city: true,
          address: true,
        },
      },
      order: { roomNumber: 'ASC' },
    });
  }

  /**
   * Room inventory matched by (hostelId, roomNumber) — one query, no N+1.
   * Residents only store `roomNumber` as text (no FK to rooms), so we
   * batch-load the Room rows to enrich with type / floor.
   * Keyed by roomNumber for O(1) lookup in the service mapper.
   */
  public async findRoomsByNumbers(
    hostelId: string,
    roomNumbers: string[],
  ): Promise<Map<string, Room>> {
    const unique = [...new Set(roomNumbers.map((n) => n?.trim()).filter(Boolean))];
    if (unique.length === 0) return new Map();
    const rooms = await this.roomRepo.find({
      where: { hostelId, roomNumber: In(unique) },
      select: {
        id: true,
        roomNumber: true,
        type: true,
        floor: true,
      },
    });
    const byNumber = new Map<string, Room>();
    for (const room of rooms) {
      if (!byNumber.has(room.roomNumber)) byNumber.set(room.roomNumber, room);
    }
    return byNumber;
  }

  /**
   * Latest fee bill per resident (one query, no N+1).
   * Keyed by residentId for O(1) lookup in the service mapper.
   */
  public async findLatestFeesByResidentIds(residentIds: string[]): Promise<Map<string, Fee>> {
    if (residentIds.length === 0) return new Map();
    const fees = await this.feeRepo.find({
      where: { residentId: In(residentIds) },
      select: {
        id: true,
        residentId: true,
        amount: true,
        dueAmount: true,
        totalPayable: true,
        paidAmount: true,
        billingMonth: true,
        billingYear: true,
        dueDate: true,
        status: true,
      },
      order: { billingYear: 'DESC', billingMonth: 'DESC', createdAt: 'DESC' },
    });
    const latest = new Map<string, Fee>();
    for (const fee of fees) {
      if (!latest.has(fee.residentId)) latest.set(fee.residentId, fee);
    }
    return latest;
  }

  public async findLeaveTypes(hostelId: string): Promise<LeaveType[]> {
    return this.leaveTypeRepo.find({
      where: { hostelId },
      order: { name: 'ASC' },
    });
  }

  public async createOrUpdateRating(data: {
    hostelId: string;
    userId?: string | null;
    rating: number;
    comment?: string | null;
  }): Promise<HostelRating> {
    if (data.userId) {
      const existing = await this.ratingRepo.findOne({
        where: { hostelId: data.hostelId, userId: data.userId },
      });
      if (existing) {
        existing.rating = data.rating;
        existing.comment = data.comment ?? null;
        return this.ratingRepo.save(existing);
      }
    }

    const newRating = this.ratingRepo.create({
      hostelId: data.hostelId,
      userId: data.userId || null,
      rating: data.rating,
      comment: data.comment || null,
    });
    return this.ratingRepo.save(newRating);
  }

  public async findRatingsByHostelId(hostelId: string, limit = 10): Promise<HostelRating[]> {
    return this.ratingRepo.find({
      where: { hostelId },
      relations: { user: true },
      select: {
        id: true,
        hostelId: true,
        userId: true,
        rating: true,
        comment: true,
        createdAt: true,
        updatedAt: true,
        user: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
      },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  public async getRatingStatsByHostelId(
    hostelId: string,
  ): Promise<{ total: number; averageRating: number }> {
    const raw = await this.ratingRepo
      .createQueryBuilder('rating')
      .select('COUNT(*)', 'total')
      .addSelect('AVG(rating.rating)', 'averageRating')
      .where('rating.hostelId = :hostelId', { hostelId })
      .getRawOne<{ total: string; averageRating: string | null }>();

    const total = parseInt(raw?.total || '0', 10);
    const avg = raw?.averageRating ? parseFloat(parseFloat(raw.averageRating).toFixed(1)) : 0;
    return { total, averageRating: avg };
  }
}
