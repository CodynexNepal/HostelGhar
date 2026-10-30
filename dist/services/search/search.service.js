"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: search.service.ts
// PURPOSE: Unified role-aware global search across database entities.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchService = exports.SearchService = void 0;
const database_source_1 = require("../../database/database-source");
const user_entity_1 = require("../../entities/user.entity");
const hostel_entity_1 = require("../../entities/hostel/hostel.entity");
const booking_entity_1 = require("../../entities/booking/booking.entity");
const resident_entity_1 = require("../../entities/resident/resident.entity");
const fee_entity_1 = require("../../entities/fee/fee.entity");
const room_entity_1 = require("../../entities/room/room.entity");
const notification_entity_1 = require("../../entities/notification/notification.entity");
const enum_constant_1 = require("../../constant/enum.constant");
class SearchService {
    async search(userId, role, queryText, category, limit = 20, hostelIdParam) {
        const q = queryText.trim();
        if (!q) {
            return { query: '', total: 0, categories: {}, results: [] };
        }
        const normalizedRole = (role || '').toUpperCase();
        const results = [];
        const term = `%${q}%`;
        const itemLimit = Math.min(Math.max(1, limit), 50);
        const isSuperAdmin = normalizedRole === 'ADMIN' ||
            normalizedRole === 'SUPER_ADMIN' ||
            normalizedRole === enum_constant_1.IROLES.ADMIN;
        const isOwner = normalizedRole === 'HOSTEL_OWNER' || normalizedRole === enum_constant_1.IROLES.OWNER;
        if (isSuperAdmin) {
            await this.searchAdmin(term, q, results, category, itemLimit);
        }
        else if (isOwner) {
            await this.searchOwner(userId, hostelIdParam, term, q, results, category, itemLimit);
        }
        else {
            await this.searchResident(userId, term, q, results, category, itemLimit);
        }
        // Build category breakdown
        const categories = {};
        for (const item of results) {
            categories[item.category] = (categories[item.category] || 0) + 1;
        }
        return {
            query: q,
            total: results.length,
            categories,
            results: results.slice(0, itemLimit),
        };
    }
    async searchAdmin(term, q, results, category, limit = 20) {
        const userRepo = database_source_1.AppDataSource.getRepository(user_entity_1.User);
        const hostelRepo = database_source_1.AppDataSource.getRepository(hostel_entity_1.Hostel);
        const bookingRepo = database_source_1.AppDataSource.getRepository(booking_entity_1.Booking);
        // 1. Search Users
        if (!category || category === 'all' || category === 'users' || category === 'owners') {
            const users = await userRepo
                .createQueryBuilder('u')
                .where('u.firstName ILIKE :term OR u.lastName ILIKE :term OR u.email ILIKE :term OR u.phone ILIKE :term', {
                term,
            })
                .take(limit)
                .getMany();
            for (const u of users) {
                const isOwnerRole = u.role === enum_constant_1.IROLES.OWNER || String(u.role).includes('OWNER');
                results.push({
                    id: u.id,
                    title: `${u.firstName} ${u.lastName}`.trim(),
                    subtitle: `${u.email} • Role: ${u.role}`,
                    category: 'users',
                    badge: u.role,
                    url: isOwnerRole ? `/admin/owners` : `/admin`,
                });
            }
        }
        // 2. Search Hostels
        if (!category || category === 'all' || category === 'hostels') {
            const hostels = await hostelRepo
                .createQueryBuilder('h')
                .where('h.name ILIKE :term OR h.city ILIKE :term OR h.address ILIKE :term OR h.email ILIKE :term', {
                term,
            })
                .take(limit)
                .getMany();
            for (const h of hostels) {
                results.push({
                    id: h.id,
                    title: h.name,
                    subtitle: `${h.city || 'Nepal'} • ${h.type || 'Hostel'}`,
                    category: 'hostels',
                    badge: h.isActive ? 'Active' : 'Inactive',
                    url: `/admin/hostels`,
                });
            }
        }
        // 3. Search Bookings
        if (!category || category === 'all' || category === 'bookings') {
            const bookings = await bookingRepo
                .createQueryBuilder('b')
                .leftJoinAndSelect('b.hostel', 'h')
                .where('b.studentName ILIKE :term OR b.email ILIKE :term OR b.phone ILIKE :term OR b.remarks ILIKE :term', {
                term,
            })
                .take(limit)
                .getMany();
            for (const b of bookings) {
                results.push({
                    id: b.id,
                    title: b.studentName || 'Booking Application',
                    subtitle: `Hostel: ${b.hostel?.name || 'N/A'} • Status: ${b.status}`,
                    category: 'bookings',
                    badge: b.status,
                    url: `/admin`,
                });
            }
        }
    }
    async searchOwner(userId, hostelIdParam, term, q, results, category, limit = 20) {
        const hostelRepo = database_source_1.AppDataSource.getRepository(hostel_entity_1.Hostel);
        const residentRepo = database_source_1.AppDataSource.getRepository(resident_entity_1.Resident);
        const bookingRepo = database_source_1.AppDataSource.getRepository(booking_entity_1.Booking);
        const feeRepo = database_source_1.AppDataSource.getRepository(fee_entity_1.Fee);
        const roomRepo = database_source_1.AppDataSource.getRepository(room_entity_1.Room);
        // Get owner's hostels
        const hostels = await hostelRepo.find({
            where: { ownerId: userId },
            select: ['id', 'name'],
        });
        const hostelIds = hostels.map((h) => h.id);
        if (hostelIds.length === 0)
            return;
        // Filter to selected hostel if provided and valid
        const targetHostelIds = hostelIdParam && hostelIds.includes(hostelIdParam) ? [hostelIdParam] : hostelIds;
        // 1. Search Residents
        if (!category || category === 'all' || category === 'residents') {
            const residents = await residentRepo
                .createQueryBuilder('r')
                .leftJoinAndSelect('r.user', 'u')
                .where('r.hostelId IN (:...targetHostelIds)', { targetHostelIds })
                .andWhere('(u.firstName ILIKE :term OR u.lastName ILIKE :term OR u.email ILIKE :term OR u.phone ILIKE :term OR r.roomNumber ILIKE :term OR r.bedNumber ILIKE :term)', { term })
                .take(limit)
                .getMany();
            for (const r of residents) {
                results.push({
                    id: r.id,
                    title: `${r.user?.firstName || ''} ${r.user?.lastName || ''}`.trim() || 'Resident',
                    subtitle: `Room: ${r.roomNumber || 'N/A'} • Bed: ${r.bedNumber || 'N/A'} • Phone: ${r.user?.phone || 'N/A'}`,
                    category: 'residents',
                    badge: r.isActive ? 'Active' : 'Former',
                    url: `/residents`,
                });
            }
        }
        // 2. Search Bookings
        if (!category || category === 'all' || category === 'bookings') {
            const bookings = await bookingRepo
                .createQueryBuilder('b')
                .where('b.hostelId IN (:...targetHostelIds)', { targetHostelIds })
                .andWhere('(b.studentName ILIKE :term OR b.email ILIKE :term OR b.phone ILIKE :term OR b.remarks ILIKE :term)', { term })
                .take(limit)
                .getMany();
            for (const b of bookings) {
                results.push({
                    id: b.id,
                    title: b.studentName || 'Booking Request',
                    subtitle: `Check-in: ${b.checkInDate} • Phone: ${b.phone || 'N/A'}`,
                    category: 'bookings',
                    badge: b.status,
                    url: `/hostel/bookings`,
                });
            }
        }
        // 3. Search Rooms
        if (!category || category === 'all' || category === 'rooms') {
            const rooms = await roomRepo
                .createQueryBuilder('rm')
                .where('rm.hostelId IN (:...targetHostelIds)', { targetHostelIds })
                .andWhere('(rm.roomNumber ILIKE :term OR rm.floor ILIKE :term)', { term })
                .take(limit)
                .getMany();
            for (const rm of rooms) {
                results.push({
                    id: rm.id,
                    title: `Room ${rm.roomNumber}`,
                    subtitle: `Floor: ${rm.floor} • Capacity: ${rm.capacity} • Status: ${rm.status}`,
                    category: 'rooms',
                    badge: rm.status,
                    url: `/rooms`,
                });
            }
        }
        // 4. Search Fees / Payments
        if (!category || category === 'all' || category === 'payments') {
            const fees = await feeRepo
                .createQueryBuilder('f')
                .leftJoinAndSelect('f.resident', 'r')
                .leftJoinAndSelect('r.user', 'u')
                .where('f.hostelId IN (:...targetHostelIds)', { targetHostelIds })
                .andWhere('(CAST(f.billingMonth AS text) ILIKE :term OR CAST(f.billingYear AS text) ILIKE :term OR u.firstName ILIKE :term OR u.lastName ILIKE :term)', {
                term,
            })
                .take(limit)
                .getMany();
            for (const f of fees) {
                results.push({
                    id: f.id,
                    title: `Fee - Month ${f.billingMonth}/${f.billingYear}`,
                    subtitle: `Resident: ${f.resident?.user?.firstName || ''} ${f.resident?.user?.lastName || ''} • Amount: Rs. ${f.amount}`,
                    category: 'payments',
                    badge: f.status,
                    url: `/fees`,
                });
            }
        }
    }
    async searchResident(userId, term, q, results, category, limit = 20) {
        const bookingRepo = database_source_1.AppDataSource.getRepository(booking_entity_1.Booking);
        const feeRepo = database_source_1.AppDataSource.getRepository(fee_entity_1.Fee);
        const residentRepo = database_source_1.AppDataSource.getRepository(resident_entity_1.Resident);
        const notifRepo = database_source_1.AppDataSource.getRepository(notification_entity_1.Notification);
        // 1. My Bookings
        if (!category || category === 'all' || category === 'bookings') {
            const bookings = await bookingRepo
                .createQueryBuilder('b')
                .leftJoinAndSelect('b.hostel', 'h')
                .where('b.userId = :userId', { userId })
                .andWhere('(b.studentName ILIKE :term OR h.name ILIKE :term OR b.remarks ILIKE :term)', {
                term,
            })
                .take(limit)
                .getMany();
            for (const b of bookings) {
                results.push({
                    id: b.id,
                    title: `Booking at ${b.hostel?.name || 'Hostel'}`,
                    subtitle: `Check-in: ${b.checkInDate} • Status: ${b.status}`,
                    category: 'bookings',
                    badge: b.status,
                    url: `/resident/bookings`,
                });
            }
        }
        // 2. My Fees
        const resident = await residentRepo.findOne({ where: { userId } });
        if (resident && (!category || category === 'all' || category === 'payments')) {
            const fees = await feeRepo
                .createQueryBuilder('f')
                .where('f.residentId = :residentId', { residentId: resident.id })
                .andWhere('(CAST(f.billingMonth AS text) ILIKE :term OR CAST(f.billingYear AS text) ILIKE :term)', { term })
                .take(limit)
                .getMany();
            for (const f of fees) {
                results.push({
                    id: f.id,
                    title: `Fee for Month ${f.billingMonth}/${f.billingYear}`,
                    subtitle: `Amount: Rs. ${f.amount} • Due: ${f.dueDate || 'N/A'}`,
                    category: 'payments',
                    badge: f.status,
                    url: `/resident/payments`,
                });
            }
        }
        // 3. My Notifications
        if (!category || category === 'all' || category === 'notifications') {
            const notifs = await notifRepo
                .createQueryBuilder('n')
                .where('n.userId = :userId', { userId })
                .andWhere('(n.title ILIKE :term OR n.message ILIKE :term)', { term })
                .take(limit)
                .getMany();
            for (const n of notifs) {
                results.push({
                    id: n.id,
                    title: n.title,
                    subtitle: n.message,
                    category: 'notifications',
                    badge: n.entityType,
                    url: n.targetUrl || '/resident',
                });
            }
        }
    }
}
exports.SearchService = SearchService;
exports.searchService = new SearchService();
