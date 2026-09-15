// ──────────────────────────────────────────────────────────────────────────────
// FILE: owner.repository.ts
// PURPOSE: Data access layer for Owner operations on Hostels, Residents, LeaveTypes, and Fees.
// ──────────────────────────────────────────────────────────────────────────────

import { In, IsNull, Repository } from 'typeorm';
import { AppDataSource } from '../../database/database-source';
import { Hostel } from '../../entities/hostel/hostel.entity';
import { User } from '../../entities/user.entity';
import { Resident } from '../../entities/resident/resident.entity';
import { LeaveType } from '../../entities/leave/leave-type.entity';
import { Room } from '../../entities/room/room.entity';

export class OwnerRepository {
  private hostelRepo: Repository<Hostel>;
  private userRepo: Repository<User>;
  private residentRepo: Repository<Resident>;
  private leaveTypeRepo: Repository<LeaveType>;
  private roomRepo: Repository<Room>;

  constructor() {
    this.hostelRepo = AppDataSource.getRepository(Hostel);
    this.userRepo = AppDataSource.getRepository(User);
    this.residentRepo = AppDataSource.getRepository(Resident);
    this.leaveTypeRepo = AppDataSource.getRepository(LeaveType);
    this.roomRepo = AppDataSource.getRepository(Room);
  }

  public async findHostelByIdAndOwner(hostelId: string, ownerId: string): Promise<Hostel | null> {
    return await this.hostelRepo.findOne({
      where: { id: hostelId, ownerId },
    });
  }

  public async findHostelById(hostelId: string): Promise<Hostel | null> {
    return await this.hostelRepo.findOne({
      where: { id: hostelId },
    });
  }

  public async findUserByEmail(email: string): Promise<User | null> {
    return await this.userRepo.findOne({ where: { email } });
  }

  public async createUser(userData: Partial<User>): Promise<User> {
    const user = this.userRepo.create(userData);
    return await this.userRepo.save(user);
  }

  public async createResident(residentData: Partial<Resident>): Promise<Resident> {
    const resident = this.residentRepo.create(residentData);
    return await this.residentRepo.save(resident);
  }

  public async saveResident(resident: Resident): Promise<Resident> {
    return await this.residentRepo.save(resident);
  }

  public async saveHostel(hostel: Hostel): Promise<Hostel> {
    return await this.hostelRepo.save(hostel);
  }

  public async saveRoom(room: Room): Promise<Room> {
    return await this.roomRepo.save(room);
  }

  /**
   * Single room lookup scoped to a hostel — used to validate the
   * Room number / Bed number picked in the Add-Resident form.
   * roomNumber match is exact after trim (same convention as residents).
   */
  public async findRoomByHostelAndNumber(
    hostelId: string,
    roomNumber: string,
  ): Promise<Room | null> {
    const roomNo = roomNumber?.trim();
    if (!roomNo) return null;
    return await this.roomRepo.findOne({
      where: { hostelId, roomNumber: roomNo },
    });
  }

  /**
   * Owner's room with NO hostel link (hostelId NULL) matched by room number.
   * Lets the Add-Resident POST adopt rooms created before linking a hostel.
   * Scoped by ownerId so owners can never touch another owner's rooms.
   */
  public async findUnlinkedOwnerRoomByNumber(
    ownerId: string,
    roomNumber: string,
  ): Promise<Room | null> {
    const roomNo = roomNumber?.trim();
    if (!roomNo) return null;
    return await this.roomRepo.findOne({
      where: { ownerId, roomNumber: roomNo, hostelId: IsNull() },
    });
  }

  public async findResidentByIdAndOwner(
    residentId: string,
    ownerId: string,
  ): Promise<Resident | null> {
    return await this.residentRepo.findOne({
      where: {
        id: residentId,
        hostel: { ownerId },
      },
      relations: { hostel: true, user: true },
    });
  }

  // ─── Resident form dynamic options (hostel → flat → room → rent/bed) ──────

  /**
   * Slim hostel list for the "Hostel" dropdown in the Add-Resident form.
   */
  public async findHostelOptionsByOwner(
    ownerId: string,
  ): Promise<Pick<Hostel, 'id' | 'name' | 'type' | 'city' | 'address'>[]> {
    return await this.hostelRepo.find({
      where: { ownerId },
      select: { id: true, name: true, type: true, city: true, address: true },
      order: { name: 'ASC' },
    });
  }

  /**
   * All hostels (admin view) for the "Hostel" dropdown.
   */
  public async findAllHostelOptions(): Promise<
    Pick<Hostel, 'id' | 'name' | 'type' | 'city' | 'address'>[]
  > {
    return await this.hostelRepo.find({
      select: { id: true, name: true, type: true, city: true, address: true },
      order: { name: 'ASC' },
    });
  }

  /**
   * Distinct flat/floor list for the "Flat" dropdown once a hostel is picked.
   * `flat` is an alias of Room.floor (no separate flat column exists).
   * Returns [{ flat, floor, roomCount }] ordered ASC. Rooms with NULL floor
   * are grouped under flat 0 so they are still selectable in the form
   * (rent/bed data for those rooms still loads from the rooms endpoint).
   *
   * IMPORTANT — why this takes ownerId:
   * Rooms can be created WITHOUT a hostel link (hostelId IS NULL, see
   * CreateRoomDto.hostelId optional). A strict `hostelId = X` filter would
   * then return [] even though the owner DID add rooms. When ownerId is
   * given we also include that owner's unlinked rooms so the dropdown
   * never comes back empty for rooms the owner actually created.
   */
  public async findFlatOptionsByHostel(
    hostelId: string,
    ownerId?: string,
  ): Promise<{ flat: number; floor: number | null; roomCount: number }[]> {
    const qb = this.roomRepo
      .createQueryBuilder('room')
      .select('COALESCE(room.floor, 0)', 'flat')
      .addSelect('COUNT(room.id)', 'roomCount');
    if (ownerId) {
      qb.where('(room.hostelId = :hostelId OR (room.hostelId IS NULL AND room.ownerId = :ownerId))', {
        hostelId,
        ownerId,
      });
    } else {
      qb.where('room.hostelId = :hostelId', { hostelId });
    }
    const rows = await qb
      .groupBy('COALESCE(room.floor, 0)')
      .orderBy('COALESCE(room.floor, 0)', 'ASC')
      .getRawMany<{ flat: string; roomCount: string }>();
    return rows.map((r) => ({
      flat: Number(r.flat),
      floor: Number(r.flat) === 0 ? null : Number(r.flat),
      roomCount: Number(r.roomCount),
    }));
  }

  /**
   * Room list for the "Room number" dropdown once hostel (+ optional flat) is picked.
   * `flat === 0` matches rooms with NULL floor. Ordered by roomNumber ASC.
   * Includes monthlyRent so the frontend can auto-fill "Monthly rent (Rs.)".
   *
   * When ownerId is given, also returns that owner's rooms whose hostelId
   * is NULL (created before linking a hostel) so the dashboard dropdown
   * shows every room the owner added — not just hostel-linked ones.
   * Each returned room carries `hostelLinked` so the UI can badge
   * "unlinked" rooms if it wants.
   */
  public async findRoomOptionsByHostel(
    hostelId: string,
    flat?: number,
    ownerId?: string,
  ): Promise<(Room & { hostelLinked?: boolean })[]> {
    const qb = this.roomRepo
      .createQueryBuilder('room')
      .select([
        'room.id',
        'room.roomNumber',
        'room.type',
        'room.capacity',
        'room.monthlyRent',
        'room.floor',
        'room.status',
        'room.occupied',
        'room.hostelId',
        'room.ownerId',
      ])
      .orderBy('room.roomNumber', 'ASC');

    if (ownerId) {
      qb.where(
        '(room.hostelId = :hostelId OR (room.hostelId IS NULL AND room.ownerId = :ownerId))',
        { hostelId, ownerId },
      );
    } else {
      qb.where('room.hostelId = :hostelId', { hostelId });
    }

    if (flat !== undefined && !Number.isNaN(flat)) {
      if (flat === 0) {
        qb.andWhere('room.floor IS NULL');
      } else {
        qb.andWhere('room.floor = :flat', { flat });
      }
    }

    const rooms = await qb.getMany();
    return rooms.map((r) => ({
      ...r,
      hostelLinked: r.hostelId != null && String(r.hostelId) === String(hostelId),
    }));
  }

  /**
   * Taken bed numbers per room: Map<roomNumber, takenBedNumbers[]>.
   * Only ACTIVE residents are counted.
   */
  public async findTakenBedsByHostel(
    hostelId: string,
    roomNumbers: string[],
  ): Promise<Map<string, string[]>> {
    const unique = [...new Set(roomNumbers.map((n) => n?.trim()).filter(Boolean))];
    if (unique.length === 0) return new Map();
    const residents = await this.residentRepo.find({
      where: { hostelId, roomNumber: In(unique), isActive: true },
      select: { roomNumber: true, bedNumber: true },
    });
    const byRoom = new Map<string, string[]>();
    for (const r of residents) {
      const key = r.roomNumber?.trim();
      if (!key) continue;
      if (!byRoom.has(key)) byRoom.set(key, []);
      if (r.bedNumber?.trim()) byRoom.get(key)!.push(r.bedNumber.trim());
    }
    return byRoom;
  }

  /**
   * DEBUG counts: why is my rooms dropdown/list empty?
   * Returns room/hostel ownership breakdown for the logged-in owner.
   */
  public async debugRoomsCount(
    ownerId: string,
    hostelId?: string,
  ): Promise<{
    myHostels: { id: string; name: string }[];
    requestedHostelOwned: boolean | null;
    mine: number;
    linkedToHostel: number | null;
    unlinkedMine: number;
    linkedToMyOtherHostels: number;
    sampleMine: { id: string; roomNumber: string; hostelId: string | null }[];
  }> {
    const myHostels = await this.hostelRepo.find({
      where: { ownerId },
      select: { id: true, name: true },
      order: { name: 'ASC' },
    });
    const mine = await this.roomRepo.count({ where: { ownerId } });
    const unlinkedMine = await this.roomRepo.count({ where: { ownerId, hostelId: IsNull() } });
    const sampleMine = await this.roomRepo.find({
      where: { ownerId },
      select: { id: true, roomNumber: true, hostelId: true },
      order: { createdAt: 'DESC' },
      take: 10,
    });

    let requestedHostelOwned: boolean | null = null;
    let linkedToHostel: number | null = null;
    let linkedToMyOtherHostels = 0;
    if (hostelId) {
      requestedHostelOwned = myHostels.some((h) => h.id === hostelId);
      linkedToHostel = await this.roomRepo.count({ where: { hostelId } });
      if (myHostels.length > 0) {
        const otherIds = myHostels.map((h) => h.id).filter((id) => id !== hostelId);
        linkedToMyOtherHostels =
          otherIds.length > 0 ? await this.roomRepo.count({ where: { hostelId: In(otherIds) } }) : 0;
      }
    }

    return {
      myHostels,
      requestedHostelOwned,
      mine,
      linkedToHostel,
      unlinkedMine,
      linkedToMyOtherHostels,
      sampleMine: sampleMine.map((r) => ({
        id: r.id,
        roomNumber: r.roomNumber,
        hostelId: r.hostelId ?? null,
      })),
    };
  }

  public async createLeaveType(leaveTypeData: Partial<LeaveType>): Promise<LeaveType> {
    const leaveType = this.leaveTypeRepo.create(leaveTypeData);
    return await this.leaveTypeRepo.save(leaveType);
  }

  public async findLeaveTypeByName(hostelId: string, name: string): Promise<LeaveType | null> {
    return await this.leaveTypeRepo.findOne({
      where: { hostelId, name },
    });
  }

  public async findResidentsByHostel(hostelId: string): Promise<Resident[]> {
    return await this.residentRepo.find({
      where: { hostelId, isActive: true },
      relations: { user: true },
    });
  }

  /**
   * All ACTIVE residents across every hostel owned by `ownerId` (one query, no N+1).
   * Slim projection only — NEVER password / tokens. Includes hostel + user joins
   * so the response can say WHICH hostel each resident lives in.
   * Optional `hostelId` narrows to a single owned hostel (still owner-scoped).
   */
  public async findResidentsByOwner(
    ownerId: string,
    hostelId?: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<[Resident[], number]> {
    const qb = this.residentRepo
      .createQueryBuilder('resident')
      .innerJoinAndSelect('resident.hostel', 'hostel')
      .innerJoinAndSelect('resident.user', 'user')
      .where('resident.isActive = :isActive', { isActive: true })
      .andWhere('hostel.ownerId = :ownerId', { ownerId });

    if (hostelId) {
      qb.andWhere('resident.hostelId = :hostelId', { hostelId });
    }

    qb.select([
      'resident.id',
      'resident.hostelId',
      'resident.roomNumber',
      'resident.bedNumber',
      'resident.monthlyRent',
      'resident.photoUrl',
      'resident.createdAt',
      'hostel.id',
      'hostel.name',
      'hostel.type',
      'hostel.city',
      'hostel.address',
      'user.id',
      'user.firstName',
      'user.lastName',
      'user.email',
      'user.phone',
      'user.avatarUrl',
    ])
      .orderBy('hostel.name', 'ASC')
      .addOrderBy('resident.roomNumber', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    return await qb.getManyAndCount();
  }

  /**
   * Room inventory for enrichment — batch load by (hostelId, roomNumber)
   * since residents store roomNumber as plain text (no FK). One query, no N+1.
   * Key: `${hostelId}::${roomNumber.trim()}` for O(1) lookup in the controller.
   */
  public async findRoomsForResidents(
    residents: Pick<Resident, 'hostelId' | 'roomNumber'>[],
  ): Promise<Map<string, Room>> {
    const hostelIds = [...new Set(residents.map((r) => r.hostelId).filter(Boolean))];
    const roomNumbers = [
      ...new Set(residents.map((r) => r.roomNumber?.trim()).filter(Boolean) as string[]),
    ];
    if (hostelIds.length === 0 || roomNumbers.length === 0) return new Map();
    const rooms = await this.roomRepo.find({
      where: { hostelId: In(hostelIds), roomNumber: In(roomNumbers) },
      select: { id: true, hostelId: true, roomNumber: true, type: true, floor: true },
    });
    const byKey = new Map<string, Room>();
    for (const room of rooms) {
      const key = `${room.hostelId}::${room.roomNumber?.trim()}`;
      if (!byKey.has(key)) byKey.set(key, room);
    }
    return byKey;
  }
}
