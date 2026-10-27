"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: hostel.service.ts
// PURPOSE: Business logic for hostels with 3-tier caching & pagination.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.HostelService = void 0;
const statusCode_interface_1 = require("../../constant/statusCode.interface");
const cache_util_1 = require("../../utils/cache.util");
const pagination_util_1 = require("../../utils/pagination.util");
const roles_enum_1 = require("../../enum/roles.enum");
class HostelService {
    constructor(hostelRepository) {
        this.hostelRepository = hostelRepository;
    }
    async listHostels(page, limit) {
        const cacheKey = cache_util_1.cacheService.generateKey('public:hostels:list', { page, limit, v: 3 });
        // 3-Level Caching: L1 Memory LRU -> L2 Redis -> L3 Database Loader
        const { data, isCached, cacheLevel } = await cache_util_1.cacheService.wrap(cacheKey, async () => {
            const [hostels, total] = await this.hostelRepository.findAll(page, limit);
            return { hostels, total };
        }, { l1TtlSeconds: 30, l2TtlSeconds: 180 });
        return (0, pagination_util_1.createPaginatedResponse)(data.hostels, data.total, { page, limit }, { isCached, cacheLevel });
    }
    async getHostel(id) {
        const cacheKey = cache_util_1.cacheService.generateKey('public:hostel:v3', id);
        const { data: hostel, isCached, cacheLevel, } = await cache_util_1.cacheService.wrap(cacheKey, async () => await this.hostelRepository.findById(id), {
            l1TtlSeconds: 60,
            l2TtlSeconds: 300,
        });
        if (!hostel) {
            return { error: { status: statusCode_interface_1.STATUS_CODE.NOT_FOUND, message: 'Hostel not found' } };
        }
        return { data: hostel, isCached, cacheLevel };
    }
    async getHostelResidents(id, access) {
        const role = access?.role?.toLowerCase();
        // Owner must own this hostel; admin bypasses ownership. This keeps the
        // 403 meaningful (wrong hostel vs wrong role) instead of leaking data.
        if (access && role === roles_enum_1.IROLES.OWNER) {
            const hostel = await this.hostelRepository.findHostelOwner(id);
            if (!hostel) {
                return { error: { status: statusCode_interface_1.STATUS_CODE.NOT_FOUND, message: 'Hostel not found' } };
            }
            if (hostel.ownerId !== access.userId) {
                return {
                    error: {
                        status: statusCode_interface_1.STATUS_CODE.FORBIDDEN,
                        message: 'You do not own this hostel. Use GET /owner/residents?hostelId=<your-own-hostel-id> or pick a hostel from GET /owner/residents/form-options/hostels.',
                    },
                };
            }
        }
        // Resident self-scope: a resident may read THIS endpoint only for the
        // hostel they live in, and only sees their OWN row (no emails/phones of
        // roommates). Prevents the old 403 while avoiding a privacy leak.
        const isResident = access && role === roles_enum_1.IROLES.RESIDENT;
        if (isResident) {
            const ownRow = await this.hostelRepository.findResidentInHostel(id, access.userId);
            if (!ownRow) {
                return {
                    error: {
                        status: statusCode_interface_1.STATUS_CODE.FORBIDDEN,
                        message: 'You are not an active resident of this hostel. Ask your warden to assign you (POST /owner/residents with your login email), then re-login.',
                    },
                };
            }
            const cacheKey = cache_util_1.cacheService.generateKey('hostel:residents:self', {
                hostelId: id,
                userId: access.userId,
                v: 1,
            });
            const { data: residents, isCached, cacheLevel, } = await cache_util_1.cacheService.wrap(cacheKey, async () => {
                const [fees, rooms] = await Promise.all([
                    this.hostelRepository.findLatestFeesByResidentIds([ownRow.id]),
                    this.hostelRepository.findRoomsByNumbers(id, [ownRow.roomNumber]),
                ]);
                return { list: [ownRow], fees: [...fees.entries()], rooms: [...rooms.entries()] };
            }, { l1TtlSeconds: 30, l2TtlSeconds: 120 });
            const feeByResident = new Map(residents.fees);
            const roomByNumber = new Map(residents.rooms);
            const data = residents.list.map((resident) => this.toResidentRow(resident, id, feeByResident, roomByNumber));
            return { data, isCached, cacheLevel, scope: 'self' };
        }
        // v5: + hostel (id/name/type/city/address) + flat (alias of floor) — busts old v4 L1/L2 cache.
        const cacheKey = cache_util_1.cacheService.generateKey('hostel:residents', { hostelId: id, v: 5 });
        const { data: residents, isCached, cacheLevel, } = await cache_util_1.cacheService.wrap(cacheKey, async () => {
            const list = await this.hostelRepository.findResidents(id);
            // One extra query for latest fee bills + one for room inventory
            // (no N+1 per resident). Residents store roomNumber as plain text,
            // so rooms are matched by (hostelId, roomNumber).
            const [fees, rooms] = await Promise.all([
                this.hostelRepository.findLatestFeesByResidentIds(list.map((r) => r.id)),
                this.hostelRepository.findRoomsByNumbers(id, list.map((r) => r.roomNumber)),
            ]);
            return { list, fees: [...fees.entries()], rooms: [...rooms.entries()] };
        }, { l1TtlSeconds: 30, l2TtlSeconds: 120 });
        // Map<...> does not survive JSON (Redis L2) — revive from entries.
        const feeByResident = new Map(residents.fees);
        const roomByNumber = new Map(residents.rooms);
        // Flatten Resident + User + Hostel join into the exact public shape the
        // frontend needs — nothing else (no password / tokens / docs).
        // Answers: which HOSTEL -> which RESIDENT lives in which FLAT/FLOOR,
        // which ROOM number and which BED number.
        // NOTE: there is no `flat` column in the schema. `flat` here is an alias
        // of Room.floor (the storey/flat level the room sits on).
        const data = residents.list.map((resident) => this.toResidentRow(resident, id, feeByResident, roomByNumber));
        return { data, isCached, cacheLevel };
    }
    toResidentRow(resident, hostelId, feeByResident, roomByNumber) {
        const firstName = resident.user?.firstName ?? '';
        const lastName = resident.user?.lastName ?? '';
        const latestFee = feeByResident.get(resident.id) ?? null;
        const room = roomByNumber.get(resident.roomNumber?.trim()) ?? null;
        const floor = room?.floor ?? null;
        return {
            id: resident.id,
            firstName,
            lastName,
            fullName: `${firstName} ${lastName}`.trim(),
            email: resident.user?.email ?? null,
            phone: resident.user?.phone ?? null,
            imageUrl: resident.photoUrl ?? resident.user?.avatarUrl ?? null,
            // Which hostel this resident lives in.
            hostelId: resident.hostelId ?? resident.hostel?.id ?? hostelId,
            hostelName: resident.hostel?.name ?? null,
            hostel: resident.hostel
                ? {
                    id: resident.hostel.id,
                    name: resident.hostel.name,
                    type: resident.hostel.type ?? null,
                    city: resident.hostel.city ?? null,
                    address: resident.hostel.address ?? null,
                }
                : {
                    id: resident.hostelId ?? hostelId,
                    name: null,
                    type: null,
                    city: null,
                    address: null,
                },
            // When the resident profile was created (= joined the hostel).
            joinedDate: resident.createdAt ?? null,
            // Agreed rent from the resident profile (may be null if unset).
            monthlyRent: resident.monthlyRent != null ? Number(resident.monthlyRent) : null,
            // Room assignment from the resident profile (plain text).
            roomNumber: resident.roomNumber ?? null,
            bedNumber: resident.bedNumber ?? null,
            // Enriched from rooms inventory matched by (hostelId, roomNumber).
            // Null when no Room row exists yet for that number (owner hasn't
            // created it in room management) — frontend should show "—".
            roomType: room?.type ?? null,
            floor,
            // `flat` = alias of `floor` (no separate flat column exists).
            flat: floor,
            // Latest generated bill, null if no fee generated yet.
            fee: latestFee
                ? {
                    billingMonth: latestFee.billingMonth,
                    billingYear: latestFee.billingYear,
                    amount: Number(latestFee.amount),
                    dueAmount: Number(latestFee.dueAmount),
                    totalPayable: Number(latestFee.totalPayable),
                    paidAmount: Number(latestFee.paidAmount),
                    dueDate: latestFee.dueDate,
                    status: latestFee.status,
                }
                : null,
        };
    }
    async getHostelLeaveTypes(id) {
        const cacheKey = cache_util_1.cacheService.generateKey('hostel:leave-types', id);
        const { data: leaveTypes, isCached, cacheLevel, } = await cache_util_1.cacheService.wrap(cacheKey, async () => await this.hostelRepository.findLeaveTypes(id), { l1TtlSeconds: 60, l2TtlSeconds: 300 });
        return { data: leaveTypes, isCached, cacheLevel };
    }
    async addRating(hostelId, rating, comment, userId) {
        if (!rating || rating < 1 || rating > 5) {
            return {
                error: {
                    status: statusCode_interface_1.STATUS_CODE.BAD_REQUEST,
                    message: 'Rating must be an integer between 1 and 5',
                },
            };
        }
        const hostel = await this.hostelRepository.findById(hostelId);
        if (!hostel) {
            return { error: { status: statusCode_interface_1.STATUS_CODE.NOT_FOUND, message: 'Hostel not found' } };
        }
        await this.hostelRepository.createOrUpdateRating({
            hostelId,
            userId: userId || null,
            rating,
            comment: comment ? comment.trim() : null,
        });
        const stats = await this.hostelRepository.getRatingStatsByHostelId(hostelId);
        const ratingsKey = cache_util_1.cacheService.generateKey('hostel:ratings:v1', hostelId);
        await cache_util_1.cacheService.invalidate(ratingsKey);
        return {
            data: {
                hostelId,
                rating,
                averageRating: stats.averageRating,
                totalReviews: stats.total,
                message: 'Rating recorded successfully',
            },
        };
    }
    async getRatings(hostelId) {
        const ratingsKey = cache_util_1.cacheService.generateKey('hostel:ratings:v1', hostelId);
        const { data } = await cache_util_1.cacheService.wrap(ratingsKey, async () => {
            const [stats, recentRatings] = await Promise.all([
                this.hostelRepository.getRatingStatsByHostelId(hostelId),
                this.hostelRepository.findRatingsByHostelId(hostelId, 10),
            ]);
            return {
                hostelId,
                averageRating: stats.averageRating,
                totalReviews: stats.total,
                recentRatings,
            };
        }, { l1TtlSeconds: 60, l2TtlSeconds: 300 });
        return { data };
    }
}
exports.HostelService = HostelService;
