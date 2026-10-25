import { In, Repository } from 'typeorm';
import { AppDataSource } from '../../database/database-source';
import { Hostel } from '../../entities/hostel/hostel.entity';
import { Resident } from '../../entities/resident/resident.entity';
import { LeaveType } from '../../entities/leave/leave-type.entity';
import { Fee } from '../../entities/fee/fee.entity';
import { Room } from '../../entities/room/room.entity';
import { HostelRating } from '../../entities/rating/hostel-rating.entity';
import { Bed } from '../../entities/bed/bed.entity';
import { HostelFacility } from '../../entities/facility/hostel-facility.entity';
import { BedStatus } from '../../enum/bed.enum';
import { HostelType } from '../../enum/hostel.enum';

export interface HostelListItem {
  id: string;
  name: string;
  type: HostelType;
  category: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  logoUrl: string | null;
  isFeatured: boolean;
  discountPercent?: number;
  rating: number;
  reviewCount: number;
  availableBeds: number;
  totalStudents: number;
  monthlyRent: number;
  currency: string;
  facilities: string[];
  detailUrl: string;
  owner?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    avatarUrl: string | null;
  } | null;
  createdAt: Date;
}

export interface HostelDetail extends Hostel {
  totalBeds: number;
  availableBeds: number;
  occupiedBeds: number;
  activeResidents: number;
  totalStudents: number;
  hostelFee: number;
  monthlyRent: number;
  currency: string;
  beds: {
    total: number;
    available: number;
    occupied: number;
  };
}

export class HostelRepository {
  private readonly hostelRepo: Repository<Hostel>;
  private readonly residentRepo: Repository<Resident>;
  private readonly leaveTypeRepo: Repository<LeaveType>;
  private readonly feeRepo: Repository<Fee>;
  private readonly roomRepo: Repository<Room>;
  private readonly ratingRepo: Repository<HostelRating>;
  private readonly bedRepo: Repository<Bed>;
  private readonly hostelFacilityRepo: Repository<HostelFacility>;

  constructor() {
    this.hostelRepo = AppDataSource.getRepository(Hostel);
    this.residentRepo = AppDataSource.getRepository(Resident);
    this.leaveTypeRepo = AppDataSource.getRepository(LeaveType);
    this.feeRepo = AppDataSource.getRepository(Fee);
    this.roomRepo = AppDataSource.getRepository(Room);
    this.ratingRepo = AppDataSource.getRepository(HostelRating);
    this.bedRepo = AppDataSource.getRepository(Bed);
    this.hostelFacilityRepo = AppDataSource.getRepository(HostelFacility);
  }

  public async findAll(page: number, limit: number): Promise<[HostelListItem[], number]> {
    const [hostels, total] = await this.hostelRepo.findAndCount({
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

    if (hostels.length === 0) {
      return [[], total];
    }

    const hostelIds = hostels.map((h) => h.id);

    // Parallel aggregate queries for metrics across all hostels on the page
    const [ratingsRaw, residentsRaw, availableBedsRaw, roomsRaw, facilitiesRaw] = await Promise.all(
      [
        // 1. Ratings summary (average rating & total review count)
        this.ratingRepo
          .createQueryBuilder('r')
          .select('r.hostelId', 'hostelId')
          .addSelect('AVG(r.rating)', 'avgRating')
          .addSelect('COUNT(r.id)', 'reviewCount')
          .where('r.hostelId IN (:...hostelIds)', { hostelIds })
          .groupBy('r.hostelId')
          .getRawMany<{ hostelId: string; avgRating: string; reviewCount: string }>(),

        // 2. Active residents (totalStudents)
        this.residentRepo
          .createQueryBuilder('res')
          .select('res.hostelId', 'hostelId')
          .addSelect('COUNT(res.id)', 'totalStudents')
          .where('res.hostelId IN (:...hostelIds)', { hostelIds })
          .andWhere('res.isActive = :isActive', { isActive: true })
          .groupBy('res.hostelId')
          .getRawMany<{ hostelId: string; totalStudents: string }>(),

        // 3. Bed-level available count and starting bed rent
        this.bedRepo
          .createQueryBuilder('b')
          .select('b.hostelId', 'hostelId')
          .addSelect('COUNT(b.id)', 'availableCount')
          .addSelect('MIN(b.rentAmount)', 'minRent')
          .where('b.hostelId IN (:...hostelIds)', { hostelIds })
          .andWhere('b.status = :status', { status: BedStatus.AVAILABLE })
          .groupBy('b.hostelId')
          .getRawMany<{ hostelId: string; availableCount: string; minRent: string | null }>(),

        // 4. Room-level capacity, occupancy & starting room rent (fallback)
        this.roomRepo
          .createQueryBuilder('rm')
          .select('rm.hostelId', 'hostelId')
          .addSelect('SUM(rm.capacity)', 'totalCapacity')
          .addSelect('SUM(rm.occupied)', 'totalOccupied')
          .addSelect('MIN(rm.monthlyRent)', 'minRent')
          .where('rm.hostelId IN (:...hostelIds)', { hostelIds })
          .groupBy('rm.hostelId')
          .getRawMany<{
            hostelId: string;
            totalCapacity: string;
            totalOccupied: string;
            minRent: string | null;
          }>(),

        // 5. Associated facilities with title
        this.hostelFacilityRepo
          .createQueryBuilder('hf')
          .innerJoinAndSelect('hf.facility', 'f')
          .where('hf.hostelId IN (:...hostelIds)', { hostelIds })
          .orderBy('hf.createdAt', 'ASC')
          .getMany(),
      ],
    );

    // Build metric lookup maps
    const ratingMap = new Map<string, { avg: number; count: number }>();
    for (const r of ratingsRaw) {
      ratingMap.set(r.hostelId, {
        avg: Math.round(Number(r.avgRating) * 10) / 10,
        count: Number(r.reviewCount) || 0,
      });
    }

    const residentMap = new Map<string, number>();
    for (const res of residentsRaw) {
      residentMap.set(res.hostelId, Number(res.totalStudents) || 0);
    }

    const bedMap = new Map<string, { available: number; minRent: number | null }>();
    for (const b of availableBedsRaw) {
      bedMap.set(b.hostelId, {
        available: Number(b.availableCount) || 0,
        minRent: b.minRent != null ? Number(b.minRent) : null,
      });
    }

    const roomMap = new Map<
      string,
      { capacity: number; occupied: number; minRent: number | null }
    >();
    for (const rm of roomsRaw) {
      roomMap.set(rm.hostelId, {
        capacity: Number(rm.totalCapacity) || 0,
        occupied: Number(rm.totalOccupied) || 0,
        minRent: rm.minRent != null ? Number(rm.minRent) : null,
      });
    }

    const facilityMap = new Map<string, string[]>();
    for (const hf of facilitiesRaw) {
      if (hf.facility?.title) {
        const list = facilityMap.get(hf.hostelId) ?? [];
        list.push(hf.facility.title);
        facilityMap.set(hf.hostelId, list);
      }
    }

    const items: HostelListItem[] = hostels.map((hostel) => {
      const rating = ratingMap.get(hostel.id)?.avg ?? 0;
      const reviewCount = ratingMap.get(hostel.id)?.count ?? 0;
      const totalStudents = residentMap.get(hostel.id) ?? 0;

      const bedInfo = bedMap.get(hostel.id);
      const roomInfo = roomMap.get(hostel.id);

      let availableBeds = 0;
      if (bedInfo && bedInfo.available > 0) {
        availableBeds = bedInfo.available;
      } else if (roomInfo) {
        availableBeds = Math.max(0, roomInfo.capacity - Math.max(roomInfo.occupied, totalStudents));
      }

      let monthlyRent = 0;
      if (bedInfo?.minRent && bedInfo.minRent > 0) {
        monthlyRent = bedInfo.minRent;
      } else if (roomInfo?.minRent && roomInfo.minRent > 0) {
        monthlyRent = roomInfo.minRent;
      }

      const facilities = facilityMap.get(hostel.id) ?? [];
      const category =
        hostel.type === HostelType.BOYS
          ? 'Boys Hostel'
          : hostel.type === HostelType.GIRLS
            ? 'Girls Hostel'
            : `${hostel.type} Hostel`;

      const isFeatured = rating >= 4.8 && reviewCount > 0;

      return {
        id: hostel.id,
        name: hostel.name,
        type: hostel.type,
        category,
        city: hostel.city,
        address: hostel.address,
        phone: hostel.phone,
        email: hostel.email,
        logoUrl: hostel.logoUrl,
        isFeatured,
        rating,
        reviewCount,
        availableBeds,
        totalStudents,
        monthlyRent,
        currency: 'NPR',
        facilities,
        detailUrl: `/hostel/${hostel.id}`,
        owner: hostel.owner,
        createdAt: hostel.createdAt,
      };
    });

    return [items, total];
  }

  public async findById(id: string): Promise<HostelDetail | null> {
    const [hostel, residentRaw, bedRaw, roomRaw, feeAmountRaw] = await Promise.all([
      this.hostelRepo.findOne({
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
      }),
      this.residentRepo
        .createQueryBuilder('res')
        .select('COUNT(res.id)', 'count')
        .addSelect('MIN(res.monthlyRent)', 'minRent')
        .where('res.hostelId = :id', { id })
        .andWhere('res.isActive = :isActive', { isActive: true })
        .getRawOne<{ count: string; minRent: string | null }>(),
      this.bedRepo
        .createQueryBuilder('b')
        .select('COUNT(b.id)', 'total')
        .addSelect("COUNT(CASE WHEN b.status = 'AVAILABLE' THEN 1 END)", 'available')
        .addSelect("COUNT(CASE WHEN b.status = 'OCCUPIED' THEN 1 END)", 'occupied')
        .addSelect('MIN(b.rentAmount)', 'minRent')
        .where('b.hostelId = :id', { id })
        .getRawOne<{
          total: string;
          available: string;
          occupied: string;
          minRent: string | null;
        }>(),
      this.roomRepo
        .createQueryBuilder('rm')
        .select('COALESCE(SUM(rm.capacity), 0)', 'totalCapacity')
        .addSelect('COALESCE(SUM(rm.occupied), 0)', 'totalOccupied')
        .addSelect('MIN(rm.monthlyRent)', 'minRent')
        .where('rm.hostelId = :id', { id })
        .getRawOne<{ totalCapacity: string; totalOccupied: string; minRent: string | null }>(),
      this.feeRepo
        .createQueryBuilder('fee')
        .select('MIN(fee.amount)', 'minAmount')
        .where('fee.hostelId = :id', { id })
        .andWhere('fee.amount > 0')
        .getRawOne<{ minAmount: string | null }>(),
    ]);

    if (!hostel) {
      return null;
    }

    const activeResidents = Number(residentRaw?.count) || 0;

    const bedTotal = Number(bedRaw?.total) || 0;
    const bedAvailable = Number(bedRaw?.available) || 0;
    const bedOccupied = Number(bedRaw?.occupied) || 0;

    const roomCapacity = Number(roomRaw?.totalCapacity) || 0;
    const roomOccupied = Number(roomRaw?.totalOccupied) || 0;

    let totalBeds = 0;
    let availableBeds = 0;
    let occupiedBeds = 0;

    if (bedTotal > 0) {
      if (roomCapacity > bedTotal) {
        totalBeds = roomCapacity;
        occupiedBeds = Math.max(bedOccupied, Math.max(roomOccupied, activeResidents));
        availableBeds = Math.max(0, totalBeds - occupiedBeds);
      } else {
        totalBeds = bedTotal;
        availableBeds = bedAvailable;
        occupiedBeds = bedOccupied;
      }
    } else if (roomCapacity > 0) {
      totalBeds = roomCapacity;
      occupiedBeds = Math.max(roomOccupied, activeResidents);
      availableBeds = Math.max(0, totalBeds - occupiedBeds);
    } else {
      totalBeds = 0;
      occupiedBeds = activeResidents;
      availableBeds = 0;
    }

    const bedMinRent = bedRaw?.minRent != null ? Number(bedRaw.minRent) : null;
    const roomMinRent = roomRaw?.minRent != null ? Number(roomRaw.minRent) : null;
    const resMinRent = residentRaw?.minRent != null ? Number(residentRaw.minRent) : null;
    const feeMinAmount = feeAmountRaw?.minAmount != null ? Number(feeAmountRaw.minAmount) : null;

    let monthlyRent = 0;
    if (bedMinRent != null && bedMinRent > 0) {
      monthlyRent = bedMinRent;
    } else if (roomMinRent != null && roomMinRent > 0) {
      monthlyRent = roomMinRent;
    } else if (resMinRent != null && resMinRent > 0) {
      monthlyRent = resMinRent;
    } else if (feeMinAmount != null && feeMinAmount > 0) {
      monthlyRent = feeMinAmount;
    }

    return {
      ...hostel,
      totalBeds,
      availableBeds,
      occupiedBeds,
      activeResidents,
      totalStudents: activeResidents,
      hostelFee: monthlyRent,
      monthlyRent,
      currency: 'NPR',
      beds: {
        total: totalBeds,
        available: availableBeds,
        occupied: occupiedBeds,
      },
    };
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
