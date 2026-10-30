// ──────────────────────────────────────────────────────────────────────────────
// FILE: search.service.ts
// PURPOSE: Unified role-aware global search across database entities.
// ──────────────────────────────────────────────────────────────────────────────

import { AppDataSource } from '../../database/database-source';
import { User } from '../../entities/user.entity';
import { Hostel } from '../../entities/hostel/hostel.entity';
import { Booking } from '../../entities/booking/booking.entity';
import { Resident } from '../../entities/resident/resident.entity';
import { Fee } from '../../entities/fee/fee.entity';
import { Room } from '../../entities/room/room.entity';
import { Notification } from '../../entities/notification/notification.entity';
import { IROLES } from '../../constant/enum.constant';

export interface SearchResultItem {
  id: string;
  title: string;
  subtitle: string;
  category: 'residents' | 'bookings' | 'payments' | 'hostels' | 'users' | 'rooms' | 'notifications';
  url: string;
  badge?: string;
  metadata?: Record<string, any>;
}

export interface SearchResponseData {
  query: string;
  total: number;
  categories: Record<string, number>;
  results: SearchResultItem[];
}

export class SearchService {
  public async search(
    userId: string,
    role: string,
    queryText: string,
    category?: string,
    limit: number = 20,
    hostelIdParam?: string,
  ): Promise<SearchResponseData> {
    const q = queryText.trim();
    if (!q) {
      return { query: '', total: 0, categories: {}, results: [] };
    }

    const normalizedRole = (role || '').toUpperCase();
    const results: SearchResultItem[] = [];
    const term = `%${q}%`;
    const itemLimit = Math.min(Math.max(1, limit), 50);

    const isSuperAdmin =
      normalizedRole === 'ADMIN' ||
      normalizedRole === 'SUPER_ADMIN' ||
      normalizedRole === IROLES.ADMIN;
    const isOwner = normalizedRole === 'HOSTEL_OWNER' || normalizedRole === IROLES.OWNER;

    if (isSuperAdmin) {
      await this.searchAdmin(term, q, results, category, itemLimit);
    } else if (isOwner) {
      await this.searchOwner(userId, hostelIdParam, term, q, results, category, itemLimit);
    } else {
      await this.searchResident(userId, term, q, results, category, itemLimit);
    }

    // Build category breakdown
    const categories: Record<string, number> = {};
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

  private async searchAdmin(
    term: string,
    q: string,
    results: SearchResultItem[],
    category?: string,
    limit: number = 20,
  ): Promise<void> {
    const userRepo = AppDataSource.getRepository(User);
    const hostelRepo = AppDataSource.getRepository(Hostel);
    const bookingRepo = AppDataSource.getRepository(Booking);

    // 1. Search Users
    if (!category || category === 'all' || category === 'users' || category === 'owners') {
      const users = await userRepo
        .createQueryBuilder('u')
        .where(
          'u.firstName ILIKE :term OR u.lastName ILIKE :term OR u.email ILIKE :term OR u.phone ILIKE :term',
          {
            term,
          },
        )
        .take(limit)
        .getMany();

      for (const u of users) {
        const isOwnerRole = u.role === IROLES.OWNER || String(u.role).includes('OWNER');
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
        .where(
          'h.name ILIKE :term OR h.city ILIKE :term OR h.address ILIKE :term OR h.email ILIKE :term',
          {
            term,
          },
        )
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
        .where(
          'b.studentName ILIKE :term OR b.email ILIKE :term OR b.phone ILIKE :term OR b.remarks ILIKE :term',
          {
            term,
          },
        )
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

  private async searchOwner(
    userId: string,
    hostelIdParam: string | undefined,
    term: string,
    q: string,
    results: SearchResultItem[],
    category?: string,
    limit: number = 20,
  ): Promise<void> {
    const hostelRepo = AppDataSource.getRepository(Hostel);
    const residentRepo = AppDataSource.getRepository(Resident);
    const bookingRepo = AppDataSource.getRepository(Booking);
    const feeRepo = AppDataSource.getRepository(Fee);
    const roomRepo = AppDataSource.getRepository(Room);

    // Get owner's hostels
    const hostels = await hostelRepo.find({
      where: { ownerId: userId },
      select: ['id', 'name'],
    });

    const hostelIds = hostels.map((h) => h.id);
    if (hostelIds.length === 0) return;

    // Filter to selected hostel if provided and valid
    const targetHostelIds =
      hostelIdParam && hostelIds.includes(hostelIdParam) ? [hostelIdParam] : hostelIds;

    // 1. Search Residents
    if (!category || category === 'all' || category === 'residents') {
      const residents = await residentRepo
        .createQueryBuilder('r')
        .leftJoinAndSelect('r.user', 'u')
        .where('r.hostelId IN (:...targetHostelIds)', { targetHostelIds })
        .andWhere(
          '(u.firstName ILIKE :term OR u.lastName ILIKE :term OR u.email ILIKE :term OR u.phone ILIKE :term OR r.roomNumber ILIKE :term OR r.bedNumber ILIKE :term)',
          { term },
        )
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
        .andWhere(
          '(b.studentName ILIKE :term OR b.email ILIKE :term OR b.phone ILIKE :term OR b.remarks ILIKE :term)',
          { term },
        )
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
        .andWhere(
          '(CAST(f.billingMonth AS text) ILIKE :term OR CAST(f.billingYear AS text) ILIKE :term OR u.firstName ILIKE :term OR u.lastName ILIKE :term)',
          {
            term,
          },
        )
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

  private async searchResident(
    userId: string,
    term: string,
    q: string,
    results: SearchResultItem[],
    category?: string,
    limit: number = 20,
  ): Promise<void> {
    const bookingRepo = AppDataSource.getRepository(Booking);
    const feeRepo = AppDataSource.getRepository(Fee);
    const residentRepo = AppDataSource.getRepository(Resident);
    const notifRepo = AppDataSource.getRepository(Notification);

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
        .andWhere(
          '(CAST(f.billingMonth AS text) ILIKE :term OR CAST(f.billingYear AS text) ILIKE :term)',
          { term },
        )
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

export const searchService = new SearchService();
