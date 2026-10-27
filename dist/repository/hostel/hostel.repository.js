"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HostelRepository = void 0;
const typeorm_1 = require("typeorm");
const database_source_1 = require("../../database/database-source");
const hostel_entity_1 = require("../../entities/hostel/hostel.entity");
const resident_entity_1 = require("../../entities/resident/resident.entity");
const leave_type_entity_1 = require("../../entities/leave/leave-type.entity");
const fee_entity_1 = require("../../entities/fee/fee.entity");
const room_entity_1 = require("../../entities/room/room.entity");
const hostel_rating_entity_1 = require("../../entities/rating/hostel-rating.entity");
const bed_entity_1 = require("../../entities/bed/bed.entity");
const hostel_facility_entity_1 = require("../../entities/facility/hostel-facility.entity");
const bed_enum_1 = require("../../enum/bed.enum");
const hostel_enum_1 = require("../../enum/hostel.enum");
class HostelRepository {
    constructor() {
        this.hostelRepo = database_source_1.AppDataSource.getRepository(hostel_entity_1.Hostel);
        this.residentRepo = database_source_1.AppDataSource.getRepository(resident_entity_1.Resident);
        this.leaveTypeRepo = database_source_1.AppDataSource.getRepository(leave_type_entity_1.LeaveType);
        this.feeRepo = database_source_1.AppDataSource.getRepository(fee_entity_1.Fee);
        this.roomRepo = database_source_1.AppDataSource.getRepository(room_entity_1.Room);
        this.ratingRepo = database_source_1.AppDataSource.getRepository(hostel_rating_entity_1.HostelRating);
        this.bedRepo = database_source_1.AppDataSource.getRepository(bed_entity_1.Bed);
        this.hostelFacilityRepo = database_source_1.AppDataSource.getRepository(hostel_facility_entity_1.HostelFacility);
    }
    async findAll(page, limit) {
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
        const [ratingsRaw, residentsRaw, availableBedsRaw, roomsRaw, facilitiesRaw] = await Promise.all([
            // 1. Ratings summary (average rating & total review count)
            this.ratingRepo
                .createQueryBuilder('r')
                .select('r.hostelId', 'hostelId')
                .addSelect('AVG(r.rating)', 'avgRating')
                .addSelect('COUNT(r.id)', 'reviewCount')
                .where('r.hostelId IN (:...hostelIds)', { hostelIds })
                .groupBy('r.hostelId')
                .getRawMany(),
            // 2. Active residents (totalStudents)
            this.residentRepo
                .createQueryBuilder('res')
                .select('res.hostelId', 'hostelId')
                .addSelect('COUNT(res.id)', 'totalStudents')
                .where('res.hostelId IN (:...hostelIds)', { hostelIds })
                .andWhere('res.isActive = :isActive', { isActive: true })
                .groupBy('res.hostelId')
                .getRawMany(),
            // 3. Bed-level available count and starting bed rent
            this.bedRepo
                .createQueryBuilder('b')
                .select('b.hostelId', 'hostelId')
                .addSelect('COUNT(b.id)', 'availableCount')
                .addSelect('MIN(b.rentAmount)', 'minRent')
                .where('b.hostelId IN (:...hostelIds)', { hostelIds })
                .andWhere('b.status = :status', { status: bed_enum_1.BedStatus.AVAILABLE })
                .groupBy('b.hostelId')
                .getRawMany(),
            // 4. Room-level capacity, occupancy & starting room rent (fallback)
            this.roomRepo
                .createQueryBuilder('rm')
                .select('rm.hostelId', 'hostelId')
                .addSelect('SUM(rm.capacity)', 'totalCapacity')
                .addSelect('SUM(rm.occupied)', 'totalOccupied')
                .addSelect('MIN(rm.monthlyRent)', 'minRent')
                .where('rm.hostelId IN (:...hostelIds)', { hostelIds })
                .groupBy('rm.hostelId')
                .getRawMany(),
            // 5. Associated facilities with title
            this.hostelFacilityRepo
                .createQueryBuilder('hf')
                .innerJoinAndSelect('hf.facility', 'f')
                .where('hf.hostelId IN (:...hostelIds)', { hostelIds })
                .orderBy('hf.createdAt', 'ASC')
                .getMany(),
        ]);
        // Build metric lookup maps
        const ratingMap = new Map();
        for (const r of ratingsRaw) {
            ratingMap.set(r.hostelId, {
                avg: Math.round(Number(r.avgRating) * 10) / 10,
                count: Number(r.reviewCount) || 0,
            });
        }
        const residentMap = new Map();
        for (const res of residentsRaw) {
            residentMap.set(res.hostelId, Number(res.totalStudents) || 0);
        }
        const bedMap = new Map();
        for (const b of availableBedsRaw) {
            bedMap.set(b.hostelId, {
                available: Number(b.availableCount) || 0,
                minRent: b.minRent != null ? Number(b.minRent) : null,
            });
        }
        const roomMap = new Map();
        for (const rm of roomsRaw) {
            roomMap.set(rm.hostelId, {
                capacity: Number(rm.totalCapacity) || 0,
                occupied: Number(rm.totalOccupied) || 0,
                minRent: rm.minRent != null ? Number(rm.minRent) : null,
            });
        }
        const facilityMap = new Map();
        for (const hf of facilitiesRaw) {
            if (hf.facility?.title) {
                const list = facilityMap.get(hf.hostelId) ?? [];
                list.push(hf.facility.title);
                facilityMap.set(hf.hostelId, list);
            }
        }
        const items = hostels.map((hostel) => {
            const rating = ratingMap.get(hostel.id)?.avg ?? 0;
            const reviewCount = ratingMap.get(hostel.id)?.count ?? 0;
            const totalStudents = residentMap.get(hostel.id) ?? 0;
            const bedInfo = bedMap.get(hostel.id);
            const roomInfo = roomMap.get(hostel.id);
            let availableBeds = 0;
            if (bedInfo && bedInfo.available > 0) {
                availableBeds = bedInfo.available;
            }
            else if (roomInfo) {
                availableBeds = Math.max(0, roomInfo.capacity - Math.max(roomInfo.occupied, totalStudents));
            }
            let monthlyRent = 0;
            if (bedInfo?.minRent && bedInfo.minRent > 0) {
                monthlyRent = bedInfo.minRent;
            }
            else if (roomInfo?.minRent && roomInfo.minRent > 0) {
                monthlyRent = roomInfo.minRent;
            }
            const facilities = facilityMap.get(hostel.id) ?? [];
            const category = hostel.type === hostel_enum_1.HostelType.BOYS
                ? 'Boys Hostel'
                : hostel.type === hostel_enum_1.HostelType.GIRLS
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
    async findById(id) {
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
                .getRawOne(),
            this.bedRepo
                .createQueryBuilder('b')
                .select('COUNT(b.id)', 'total')
                .addSelect("COUNT(CASE WHEN b.status = 'AVAILABLE' THEN 1 END)", 'available')
                .addSelect("COUNT(CASE WHEN b.status = 'OCCUPIED' THEN 1 END)", 'occupied')
                .addSelect('MIN(b.rentAmount)', 'minRent')
                .where('b.hostelId = :id', { id })
                .getRawOne(),
            this.roomRepo
                .createQueryBuilder('rm')
                .select('COALESCE(SUM(rm.capacity), 0)', 'totalCapacity')
                .addSelect('COALESCE(SUM(rm.occupied), 0)', 'totalOccupied')
                .addSelect('MIN(rm.monthlyRent)', 'minRent')
                .where('rm.hostelId = :id', { id })
                .getRawOne(),
            this.feeRepo
                .createQueryBuilder('fee')
                .select('MIN(fee.amount)', 'minAmount')
                .where('fee.hostelId = :id', { id })
                .andWhere('fee.amount > 0')
                .getRawOne(),
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
            }
            else {
                totalBeds = bedTotal;
                availableBeds = bedAvailable;
                occupiedBeds = bedOccupied;
            }
        }
        else if (roomCapacity > 0) {
            totalBeds = roomCapacity;
            occupiedBeds = Math.max(roomOccupied, activeResidents);
            availableBeds = Math.max(0, totalBeds - occupiedBeds);
        }
        else {
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
        }
        else if (roomMinRent != null && roomMinRent > 0) {
            monthlyRent = roomMinRent;
        }
        else if (resMinRent != null && resMinRent > 0) {
            monthlyRent = resMinRent;
        }
        else if (feeMinAmount != null && feeMinAmount > 0) {
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
    async findHostelOwner(hostelId) {
        return this.hostelRepo.findOne({
            where: { id: hostelId },
            select: { id: true, ownerId: true },
        });
    }
    async findResidentInHostel(hostelId, userId) {
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
    async findResidents(hostelId) {
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
    async findRoomsByNumbers(hostelId, roomNumbers) {
        const unique = [...new Set(roomNumbers.map((n) => n?.trim()).filter(Boolean))];
        if (unique.length === 0)
            return new Map();
        const rooms = await this.roomRepo.find({
            where: { hostelId, roomNumber: (0, typeorm_1.In)(unique) },
            select: {
                id: true,
                roomNumber: true,
                type: true,
                floor: true,
            },
        });
        const byNumber = new Map();
        for (const room of rooms) {
            if (!byNumber.has(room.roomNumber))
                byNumber.set(room.roomNumber, room);
        }
        return byNumber;
    }
    /**
     * Latest fee bill per resident (one query, no N+1).
     * Keyed by residentId for O(1) lookup in the service mapper.
     */
    async findLatestFeesByResidentIds(residentIds) {
        if (residentIds.length === 0)
            return new Map();
        const fees = await this.feeRepo.find({
            where: { residentId: (0, typeorm_1.In)(residentIds) },
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
        const latest = new Map();
        for (const fee of fees) {
            if (!latest.has(fee.residentId))
                latest.set(fee.residentId, fee);
        }
        return latest;
    }
    async findLeaveTypes(hostelId) {
        return this.leaveTypeRepo.find({
            where: { hostelId },
            order: { name: 'ASC' },
        });
    }
    async createOrUpdateRating(data) {
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
    async findRatingsByHostelId(hostelId, limit = 10) {
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
    async getRatingStatsByHostelId(hostelId) {
        const raw = await this.ratingRepo
            .createQueryBuilder('rating')
            .select('COUNT(*)', 'total')
            .addSelect('AVG(rating.rating)', 'averageRating')
            .where('rating.hostelId = :hostelId', { hostelId })
            .getRawOne();
        const total = parseInt(raw?.total || '0', 10);
        const avg = raw?.averageRating ? parseFloat(parseFloat(raw.averageRating).toFixed(1)) : 0;
        return { total, averageRating: avg };
    }
}
exports.HostelRepository = HostelRepository;
