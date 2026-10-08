import { AppDataSource } from '../../database/database-source';
import { User } from '../../entities/user.entity';
import { Hostel } from '../../entities/hostel/hostel.entity';
import { Resident } from '../../entities/resident/resident.entity';
import { Booking } from '../../entities/booking/booking.entity';
import { Fee } from '../../entities/fee/fee.entity';
import { LeaveRequest } from '../../entities/leave/leave-request.entity';
import { Room } from '../../entities/room/room.entity';
import { Bed } from '../../entities/bed/bed.entity';
import { FeeStatus } from '../../enum/fee.enum';
import { LeaveStatus } from '../../enum/leave.enum';
import { BookingStatus } from '../../enum/booking.enum';
import { BedStatus } from '../../enum/bed.enum';
import { Subscription } from '../../entities/subscription/subscription.entity';
import { BillingCycle, SubscriptionStatus } from '../../enum/subscription.enum';
import { In } from 'typeorm';

export class AnalyticsRepository {
  /**
   * Admin dashboard bootstrap: one call powers every card on
   * `/admin/dashboard` (top stats, pending approvals, hostels spotlight and
   * platform health). The legacy `getAdminSummary()` fields are still returned
   * at the top level so clients already on this endpoint keep working.
   *
   * Every metric is a COUNT/SUM aggregate issued in parallel — never a per-row
   * `find()` — so the dashboard stays a fixed number of round-trips.
   */
  public async getAdminDashboard(spotlightLimit: number = 5) {
    const userRepo = AppDataSource.getRepository(User);
    const hostelRepo = AppDataSource.getRepository(Hostel);
    const residentRepo = AppDataSource.getRepository(Resident);
    const bookingRepo = AppDataSource.getRepository(Booking);
    const feeRepo = AppDataSource.getRepository(Fee);
    const leaveRepo = AppDataSource.getRepository(LeaveRequest);
    const roomRepo = AppDataSource.getRepository(Room);
    const bedRepo = AppDataSource.getRepository(Bed);
    const subscriptionRepo = AppDataSource.getRepository(Subscription);

    const now = new Date();
    const currentMonth = now.getUTCMonth() + 1;
    const currentYear = now.getUTCFullYear();

    const [
      users,
      hostels,
      activeResidents,
      pendingBookings,
      pendingLeaves,
      unpaidFees,
      pendingSubscriptionRequests,
      activePlanRows,
      revenue,
      monthRevenue,
      roomInventory,
      bedInventory,
      recentHostels,
    ] = await Promise.all([
      userRepo.count(),
      hostelRepo.count(),
      residentRepo.count({ where: { isActive: true } }),
      bookingRepo.count({ where: { status: BookingStatus.PENDING } }),
      leaveRepo.count({ where: { status: LeaveStatus.PENDING } }),
      feeRepo.count({ where: { status: FeeStatus.PENDING } }),
      subscriptionRepo.count({ where: { status: SubscriptionStatus.PENDING } }),
      // MRR + active plans: one row per active plan, not an N+1 per owner.
      subscriptionRepo.find({
        where: { status: SubscriptionStatus.ACTIVE },
        select: { id: true, price: true, billingCycle: true, endDate: true },
      }),
      feeRepo
        .createQueryBuilder('fee')
        .select('COALESCE(SUM(fee.paidAmount), 0)', 'paid')
        .addSelect('COALESCE(SUM(fee.totalPayable - fee.paidAmount), 0)', 'outstanding')
        .getRawOne<{ paid: string; outstanding: string }>(),
      feeRepo
        .createQueryBuilder('fee')
        .select('COALESCE(SUM(fee.paidAmount), 0)', 'paid')
        .addSelect('COALESCE(SUM(fee.totalPayable), 0)', 'billed')
        .where('fee.billingMonth = :month', { month: currentMonth })
        .andWhere('fee.billingYear = :year', { year: currentYear })
        .getRawOne<{ paid: string; billed: string }>(),
      roomRepo
        .createQueryBuilder('room')
        .select('COUNT(*)', 'rooms')
        .addSelect('COALESCE(SUM(room.capacity), 0)', 'capacity')
        .addSelect('COALESCE(SUM(room.occupied), 0)', 'occupied')
        .getRawOne<{ rooms: string; capacity: string; occupied: string }>(),
      bedRepo
        .createQueryBuilder('bed')
        .select('COUNT(*)', 'total')
        .addSelect("COUNT(*) FILTER (WHERE bed.status = 'OCCUPIED')", 'occupied')
        .getRawOne<{ total: string; occupied: string }>(),
      // Hostels spotlight: newest hostels with their (optional) assigned owner.
      hostelRepo.find({
        relations: { owner: true },
        select: {
          id: true,
          name: true,
          type: true,
          city: true,
          logoUrl: true,
          createdAt: true,
          owner: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
        },
        order: { createdAt: 'DESC' },
        take: spotlightLimit,
      }),
    ]);

    // ── MRR: yearly plans are billed up-front, so amortize them over 12 months
    // to keep the headline number a true *monthly* recurring revenue figure.
    // ACTIVE rows whose endDate already lapsed are excluded from both totals.
    const activePlans = activePlanRows.filter(
      (subscription) =>
        !subscription.endDate || new Date(subscription.endDate).getTime() >= now.getTime(),
    );
    const mrr = activePlans.reduce((total, subscription) => {
      const price = Number(subscription.price) || 0;
      return total + (subscription.billingCycle === BillingCycle.YEARLY ? price / 12 : price);
    }, 0);
    // MRR diagnostics: a `Rs. 0` card is only meaningful next to the reason —
    // no plan is ACTIVE yet vs. every ACTIVE plan is FREE (price 0) vs. every
    // ACTIVE plan has lapsed and is awaiting reaping.
    const paidPlans = activePlans.filter((subscription) => Number(subscription.price) > 0);
    const freePlans = activePlans.length - paidPlans.length;
    const lapsedPlans = activePlanRows.length - activePlans.length;

    // ── Occupancy: prefer bed-level inventory, fall back to room capacity for
    // hostels that have not created beds yet (same rule as the owner summary,
    // so the admin gauge and the owner gauge never disagree).
    const bedTotal = Number(bedInventory?.total || 0);
    const hasBedInventory = bedTotal > 0;
    const roomCapacity = Number(roomInventory?.capacity || 0);
    const totalBeds = hasBedInventory ? bedTotal : roomCapacity;
    const occupiedBeds = hasBedInventory
      ? Number(bedInventory?.occupied || 0)
      : Math.min(Number(roomInventory?.occupied || 0), roomCapacity);
    const availableBeds = Math.max(0, totalBeds - occupiedBeds);
    const occupancyRate = totalBeds ? Number(((occupiedBeds / totalBeds) * 100).toFixed(1)) : 0;

    const totalRevenue = Number(revenue?.paid || 0);
    const pendingDues = Math.max(0, Number(revenue?.outstanding || 0));
    const monthlyRevenue = Number(monthRevenue?.paid || 0);
    const monthlyBilled = Number(monthRevenue?.billed || 0);

    return {
      // ── Legacy fields, unchanged shape, for clients already on this endpoint.
      users,
      hostels,
      activeResidents,
      pendingBookings,
      pendingLeaves,
      unpaidFees,
      paidAmount: totalRevenue,
      outstandingAmount: pendingDues,
      // ── Dashboard blocks.
      generatedAt: now.toISOString(),
      stats: {
        totalHostels: hostels,
        totalResidents: activeResidents,
        mrr: Number(mrr.toFixed(2)),
        // MRR is subscription revenue — explain a zero instead of leaving the
        // dashboard with a bare `Rs. 0` the admin cannot act on.
        mrrBasis: 'activeSubscriptions',
        mrrCurrency: 'NPR',
        mrrPaidPlans: paidPlans.length,
        mrrFreePlans: freePlans,
        mrrLapsedPlans: lapsedPlans,
        occupancy: { totalBeds, occupiedBeds, availableBeds, rate: occupancyRate },
      },
      pendingApprovals: {
        count: pendingSubscriptionRequests,
        reviewUrl: '/admin/subscriptions',
      },
      recentHostels: recentHostels.map((hostel) => ({
        id: hostel.id,
        name: hostel.name,
        type: hostel.type,
        city: hostel.city,
        logoUrl: hostel.logoUrl,
        createdAt: hostel.createdAt,
        owner: hostel.owner
          ? {
              id: hostel.owner.id,
              name: `${hostel.owner.firstName} ${hostel.owner.lastName}`.trim(),
              email: hostel.owner.email,
              avatarUrl: hostel.owner.avatarUrl,
            }
          : null,
      })),
      health: {
        monthlyRevenue,
        totalRevenue,
        pendingDues,
        rooms: Number(roomInventory?.rooms || 0),
        bedsOccupied: occupiedBeds,
        activePlans: activePlans.length,
        currency: 'NPR',
        collectionRate: monthlyBilled
          ? Number(((monthlyRevenue / monthlyBilled) * 100).toFixed(1))
          : 0,
      },
    };
  }

  public async getOwnerSummary(ownerId: string) {
    const hostels = await AppDataSource.getRepository(Hostel).find({
      where: { ownerId },
      select: { id: true, name: true, city: true, address: true },
      order: { name: 'ASC' },
    });
    const hostelIds = hostels.map((hostel) => hostel.id);

    if (!hostelIds.length) {
      return this.emptyOwnerSummary();
    }

    const [residents, rooms, beds, fees, pendingBookings, pendingLeaves] = await Promise.all([
      AppDataSource.getRepository(Resident).find({
        where: { hostelId: In(hostelIds) },
        select: { id: true, hostelId: true, isActive: true, createdAt: true },
      }),
      AppDataSource.getRepository(Room).find({
        where: { hostelId: In(hostelIds) },
        select: {
          id: true,
          hostelId: true,
          roomNumber: true,
          capacity: true,
          occupied: true,
          floor: true,
        },
      }),
      AppDataSource.getRepository(Bed).find({
        where: { hostelId: In(hostelIds) },
        select: { id: true, hostelId: true, roomId: true, status: true },
      }),
      AppDataSource.getRepository(Fee).find({
        where: { hostelId: In(hostelIds) },
        select: {
          id: true,
          hostelId: true,
          totalPayable: true,
          paidAmount: true,
          billingMonth: true,
          billingYear: true,
          status: true,
          createdAt: true,
        },
      }),
      AppDataSource.getRepository(Booking).count({
        where: { hostelId: In(hostelIds), status: BookingStatus.PENDING },
      }),
      AppDataSource.getRepository(LeaveRequest)
        .createQueryBuilder('leave')
        .leftJoin('leave.resident', 'resident')
        .where('resident.hostelId IN (:...hostelIds)', { hostelIds })
        .andWhere('leave.status = :status', { status: LeaveStatus.PENDING })
        .getCount(),
    ]);

    const now = new Date();
    const currentMonth = now.getUTCMonth() + 1;
    const currentYear = now.getUTCFullYear();
    const activeResidents = residents.filter((resident) => resident.isActive).length;
    const currentFees = fees.filter(
      (fee) => fee.billingMonth === currentMonth && fee.billingYear === currentYear,
    );
    const outstanding = (fee: Fee) =>
      Math.max(0, Number(fee.totalPayable) - Number(fee.paidAmount));
    const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

    const bedCounts = {
      occupied: beds.filter((bed) => bed.status === BedStatus.OCCUPIED).length,
      reserved: beds.filter((bed) => bed.status === BedStatus.RESERVED).length,
      available: beds.filter((bed) => bed.status === BedStatus.AVAILABLE).length,
      maintenance: beds.filter((bed) => bed.status === BedStatus.MAINTENANCE).length,
    };
    const hasBedInventory = beds.length > 0;
    const totalBeds = hasBedInventory ? beds.length : sum(rooms.map((room) => room.capacity));
    const occupiedBeds = hasBedInventory
      ? bedCounts.occupied
      : sum(rooms.map((room) => Math.min(room.occupied, room.capacity)));
    const availableBeds = hasBedInventory
      ? bedCounts.available
      : Math.max(0, totalBeds - occupiedBeds);
    const occupancyRate = totalBeds ? Number(((occupiedBeds / totalBeds) * 100).toFixed(1)) : 0;

    const bedsByRoom = new Map<string, typeof bedCounts>();
    for (const bed of beds) {
      const counts = bedsByRoom.get(bed.roomId) ?? {
        occupied: 0,
        reserved: 0,
        available: 0,
        maintenance: 0,
      };
      if (bed.status === BedStatus.OCCUPIED) counts.occupied++;
      if (bed.status === BedStatus.RESERVED) counts.reserved++;
      if (bed.status === BedStatus.AVAILABLE) counts.available++;
      if (bed.status === BedStatus.MAINTENANCE) counts.maintenance++;
      bedsByRoom.set(bed.roomId, counts);
    }
    const roomOccupancy = { fullyOccupied: 0, partiallyOccupied: 0, available: 0, maintenance: 0 };
    const capacityByRoom = rooms.map((room) => {
      const counts = bedsByRoom.get(room.id);
      const occupied = counts?.occupied ?? Math.min(room.occupied, room.capacity);
      const available = counts?.available ?? Math.max(0, room.capacity - occupied);
      const maintenance = counts?.maintenance ?? 0;
      if (maintenance === room.capacity && room.capacity > 0) roomOccupancy.maintenance++;
      else if (occupied >= room.capacity && room.capacity > 0) roomOccupancy.fullyOccupied++;
      else if (occupied > 0) roomOccupancy.partiallyOccupied++;
      else roomOccupancy.available++;
      return {
        roomId: room.id,
        hostelId: room.hostelId,
        roomNumber: room.roomNumber,
        floor: room.floor,
        capacity: room.capacity,
        occupied,
        reserved: counts?.reserved ?? 0,
        available,
        maintenance,
      };
    });

    const paymentStatus = Object.values(FeeStatus).map((status) => {
      const statusFees = currentFees.filter((fee) => fee.status === status);
      return {
        status,
        count: statusFees.length,
        billed: sum(statusFees.map((fee) => Number(fee.totalPayable))),
        paid: sum(statusFees.map((fee) => Number(fee.paidAmount))),
        outstanding: sum(statusFees.map(outstanding)),
      };
    });

    const monthKey = (date: Date) =>
      `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    const lastTwelveMonths = Array.from({ length: 12 }, (_, index) => {
      const date = new Date(Date.UTC(currentYear, currentMonth - 12 + index, 1));
      return { key: monthKey(date), year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
    });
    const revenueTrend = lastTwelveMonths.map(({ key, year, month }) => {
      const periodFees = fees.filter(
        (fee) => fee.billingYear === year && fee.billingMonth === month,
      );
      return {
        period: key,
        billed: sum(periodFees.map((fee) => Number(fee.totalPayable))),
        collected: sum(periodFees.map((fee) => Number(fee.paidAmount))),
        pending: sum(periodFees.map(outstanding)),
      };
    });
    const residentGrowth = lastTwelveMonths.map(({ key, year, month }) => ({
      period: key,
      joined: residents.filter(
        (resident) =>
          resident.createdAt.getUTCFullYear() === year &&
          resident.createdAt.getUTCMonth() + 1 === month,
      ).length,
    }));

    const monthlyRevenue = sum(currentFees.map((fee) => Number(fee.paidAmount)));
    const pendingAmount = sum(currentFees.map(outstanding));
    return {
      // Legacy fields are retained for clients already using this endpoint.
      hostels: hostels.length,
      activeResidents,
      pendingBookings,
      pendingLeaves,
      outstandingAmount: pendingAmount,
      generatedAt: now.toISOString(),
      hostelOptions: hostels,
      totals: {
        hostels: hostels.length,
        activeResidents,
        rooms: rooms.length,
        beds: {
          total: totalBeds,
          occupied: occupiedBeds,
          available: availableBeds,
          reserved: bedCounts.reserved,
          maintenance: bedCounts.maintenance,
        },
        occupancyRate,
        monthlyRevenue,
        pendingAmount,
        monthlyExpenses: null,
        netRevenue: null,
      },
      occupancy: {
        totalBeds,
        occupiedBeds,
        availableBeds,
        occupancyRate,
        source: hasBedInventory ? 'beds' : 'rooms',
      },
      paymentStatus: {
        billed: sum(currentFees.map((fee) => Number(fee.totalPayable))),
        collected: monthlyRevenue,
        pending: pendingAmount,
        collectionRate: currentFees.length
          ? Number(
              (
                (monthlyRevenue / sum(currentFees.map((fee) => Number(fee.totalPayable)))) *
                100
              ).toFixed(1),
            )
          : 0,
        breakdown: paymentStatus,
      },
      roomOccupancy,
      capacityByRoom,
      trends: { revenue: revenueTrend, residentGrowth },
      unavailableMetrics: ['expenses', 'maintenance', 'residentDemographics', 'residentCheckOuts'],
    };
  }

  private emptyOwnerSummary() {
    return {
      hostels: 0,
      activeResidents: 0,
      pendingBookings: 0,
      pendingLeaves: 0,
      outstandingAmount: 0,
      generatedAt: new Date().toISOString(),
      hostelOptions: [],
      totals: {
        hostels: 0,
        activeResidents: 0,
        rooms: 0,
        beds: { total: 0, occupied: 0, available: 0, reserved: 0, maintenance: 0 },
        occupancyRate: 0,
        monthlyRevenue: 0,
        pendingAmount: 0,
        monthlyExpenses: null,
        netRevenue: null,
      },
      occupancy: {
        totalBeds: 0,
        occupiedBeds: 0,
        availableBeds: 0,
        occupancyRate: 0,
        source: 'beds',
      },
      paymentStatus: { billed: 0, collected: 0, pending: 0, collectionRate: 0, breakdown: [] },
      roomOccupancy: { fullyOccupied: 0, partiallyOccupied: 0, available: 0, maintenance: 0 },
      capacityByRoom: [],
      trends: { revenue: [], residentGrowth: [] },
      unavailableMetrics: ['expenses', 'maintenance', 'residentDemographics', 'residentCheckOuts'],
    };
  }
}
