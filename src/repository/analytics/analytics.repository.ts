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

    // The 12-month window start (inclusive): one year ago, month-aligned.
    const trendStartYear = currentMonth === 12 ? currentYear : currentYear - 1;
    const trendStartMonth = currentMonth === 12 ? 1 : currentMonth + 1;

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
      // ── NEW: per-hostel bed counts (GROUP BY hostelId) ───────────────────
      hostelBedRows,
      // ── NEW: per-hostel active resident counts (GROUP BY hostelId) ───────
      hostelResidentRows,
      // ── NEW: fee counts grouped by status (all-time) ─────────────────────
      feeLifecycleRows,
      // ── NEW: 12-month revenue trend (one row per billing month) ──────────
      revenueTrendRows,
      // ── NEW: all hostels (id, name, city) for the occupancy chart ────────
      allHostels,
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
      // Per-hostel bed occupancy (GROUP BY) — powers the "Occupancy by hostel" chart.
      bedRepo
        .createQueryBuilder('bed')
        .select('bed.hostelId', 'hostelId')
        .addSelect('COUNT(*)', 'total')
        .addSelect("COUNT(*) FILTER (WHERE bed.status = 'OCCUPIED')", 'occupied')
        .addSelect("COUNT(*) FILTER (WHERE bed.status = 'AVAILABLE')", 'available')
        .groupBy('bed.hostelId')
        .getRawMany<{ hostelId: string; total: string; occupied: string; available: string }>(),
      // Per-hostel active resident count (GROUP BY) — powers "Top hostels by residents" table.
      residentRepo
        .createQueryBuilder('resident')
        .select('resident.hostelId', 'hostelId')
        .addSelect('COUNT(*)', 'count')
        .where('resident.isActive = :active', { active: true })
        .groupBy('resident.hostelId')
        .getRawMany<{ hostelId: string; count: string }>(),
      // Fee lifecycle counts by status (all-time) — powers the fee lifecycle chart.
      feeRepo
        .createQueryBuilder('fee')
        .select('fee.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('fee.status')
        .getRawMany<{ status: string; count: string }>(),
      // 12-month revenue trend — one row per billing month in the window.
      feeRepo
        .createQueryBuilder('fee')
        .select('fee.billingYear', 'year')
        .addSelect('fee.billingMonth', 'month')
        .addSelect('COALESCE(SUM(fee.paidAmount), 0)', 'collected')
        .addSelect('COALESCE(SUM(fee.totalPayable), 0)', 'billed')
        .where(
          // Include rows from trendStartYear/Month onwards (12-month window).
          '(fee.billingYear > :sy OR (fee.billingYear = :sy AND fee.billingMonth >= :sm))',
          { sy: trendStartYear, sm: trendStartMonth },
        )
        .groupBy('fee.billingYear')
        .addGroupBy('fee.billingMonth')
        .orderBy('fee.billingYear', 'ASC')
        .addOrderBy('fee.billingMonth', 'ASC')
        .getRawMany<{ year: string; month: string; collected: string; billed: string }>(),
      // All hostels (lean: id + name + city) — for occupancyByHostel entries.
      hostelRepo.find({
        select: { id: true, name: true, city: true },
        order: { name: 'ASC' },
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
    const collectionRate = monthlyBilled
      ? Number(((monthlyRevenue / monthlyBilled) * 100).toFixed(1))
      : 0;

    // ── planMix: paid/free/lapsed percentages (same formula as owner analytics).
    const planMixTotal = activePlanRows.length;
    const pct = (n: number) => (planMixTotal ? Number(((n / planMixTotal) * 100).toFixed(1)) : 0);

    // ── feeLifecycle: count per status (all-time).
    const lifecycleCount = (status: FeeStatus): number =>
      Number(feeLifecycleRows.find((r) => r.status === status)?.count ?? 0);
    const feeLifecycle = {
      total: feeLifecycleRows.reduce((sum, r) => sum + Number(r.count), 0),
      paid: lifecycleCount(FeeStatus.PAID),
      pending: lifecycleCount(FeeStatus.PENDING),
      overdue: lifecycleCount(FeeStatus.OVERDUE),
      partiallyPaid: lifecycleCount(FeeStatus.PARTIALLY_PAID),
    };

    // ── trends.revenue: fill every month in the 12-month window, zeroing gaps.
    const monthKey = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}`;
    const trendMap = new Map(
      revenueTrendRows.map((r) => [
        monthKey(Number(r.year), Number(r.month)),
        { collected: Number(r.collected), billed: Number(r.billed) },
      ]),
    );
    const revenueTrend = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(Date.UTC(trendStartYear, trendStartMonth - 1 + i, 1));
      const key = monthKey(d.getUTCFullYear(), d.getUTCMonth() + 1);
      const row = trendMap.get(key) ?? { collected: 0, billed: 0 };
      return {
        period: key,
        billed: row.billed,
        collected: row.collected,
        pending: Math.max(0, row.billed - row.collected),
      };
    });

    // ── occupancyByHostel: bed-level group-by joined with hostel names.
    // Capped to top 10 by residents so the chart payload stays predictable.
    const bedByHostel = new Map(
      hostelBedRows.map((r) => [
        r.hostelId,
        { total: Number(r.total), occupied: Number(r.occupied), available: Number(r.available) },
      ]),
    );
    const residentByHostel = new Map(hostelResidentRows.map((r) => [r.hostelId, Number(r.count)]));
    const occupancyByHostel = allHostels
      .map((hostel) => {
        const beds = bedByHostel.get(hostel.id);
        const total = beds?.total ?? 0;
        const occupied = beds?.occupied ?? 0;
        const available = beds?.available ?? 0;
        const residents = residentByHostel.get(hostel.id) ?? 0;
        return {
          hostelId: hostel.id,
          hostelName: hostel.name,
          city: hostel.city,
          totalBeds: total,
          occupiedBeds: occupied,
          availableBeds: available,
          occupancyRate: total ? Number(((occupied / total) * 100).toFixed(1)) : 0,
          residents,
        };
      })
      .sort((a, b) => b.residents - a.residents);
    const topHostelsByResidents = occupancyByHostel
      .slice(0, 5)
      .map(({ hostelId, hostelName: name, city, residents }) => ({
        hostelId,
        name,
        city,
        residents,
      }));

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

      // ── Meta ─────────────────────────────────────────────────────────────
      generatedAt: now.toISOString(),

      // ── Headline stat cards ───────────────────────────────────────────────
      stats: {
        totalHostels: hostels,
        totalResidents: activeResidents,
        mrr: Number(mrr.toFixed(2)),
        mrrBasis: 'activeSubscriptions',
        mrrCurrency: 'NPR',
        mrrPaidPlans: paidPlans.length,
        mrrFreePlans: freePlans,
        mrrLapsedPlans: lapsedPlans,
        occupancy: { totalBeds, occupiedBeds, availableBeds, rate: occupancyRate },
      },

      // ── Finance: "Collected?" / "Outstanding?" / collection-rate badge ────
      finance: {
        allTime: {
          collected: totalRevenue,
          outstanding: pendingDues,
        },
        thisMonth: {
          billed: monthlyBilled,
          collected: monthlyRevenue,
          pending: Math.max(0, monthlyBilled - monthlyRevenue),
          collectionRate,
        },
      },

      // ── Plan mix: paid/free/lapsed breakdown ─────────────────────────────
      planMix: {
        hostelsOnPlans: planMixTotal, // platform-wide active plan count
        paid: paidPlans.length,
        free: freePlans,
        lapsed: lapsedPlans,
        paidPercent: pct(paidPlans.length),
        freePercent: pct(freePlans),
        lapsedPercent: pct(lapsedPlans),
      },

      // ── Fee lifecycle chart ───────────────────────────────────────────────
      feeLifecycle,

      // ── Platform revenue trend (12 months) ───────────────────────────────
      trends: { revenue: revenueTrend },

      // ── Pending subscription-upgrade approvals ───────────────────────────
      pendingApprovals: {
        count: pendingSubscriptionRequests,
        reviewUrl: '/admin/subscriptions',
      },

      // ── Recent hostels spotlight ─────────────────────────────────────────
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

      // ── Occupancy by hostel chart ─────────────────────────────────────────
      occupancyByHostel,

      // ── Top hostels by residents table ────────────────────────────────────
      topHostelsByResidents,

      // ── Platform health card (kept for backward compat) ───────────────────
      health: {
        monthlyRevenue,
        totalRevenue,
        pendingDues,
        rooms: Number(roomInventory?.rooms || 0),
        bedsOccupied: occupiedBeds,
        activePlans: activePlans.length,
        currency: 'NPR',
        collectionRate,
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

    const [residents, rooms, beds, fees, activePlanRows] = await Promise.all([
      AppDataSource.getRepository(Resident).find({
        where: { hostelId: In(hostelIds) },
        select: { id: true, hostelId: true, isActive: true, createdAt: true },
      }),
      AppDataSource.getRepository(Room).find({
        where: { hostelId: In(hostelIds) },
        select: {
          id: true,
          hostelId: true,
          capacity: true,
          occupied: true,
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
      // Pending booking/leave counts were dropped with the lean payload:
      // the owner summary no longer reports them.
      // MRR + plan mix: single active-plan query scoped to the owner (no N+1).
      AppDataSource.getRepository(Subscription).find({
        where: { ownerId, status: SubscriptionStatus.ACTIVE },
        select: { id: true, hostelId: true, price: true, billingCycle: true, endDate: true },
      }),
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
    for (const room of rooms) {
      const counts = bedsByRoom.get(room.id);
      const occupied = counts?.occupied ?? Math.min(room.occupied, room.capacity);
      const maintenance = counts?.maintenance ?? 0;
      if (maintenance === room.capacity && room.capacity > 0) roomOccupancy.maintenance++;
      else if (occupied >= room.capacity && room.capacity > 0) roomOccupancy.fullyOccupied++;
      else if (occupied > 0) roomOccupancy.partiallyOccupied++;
      else roomOccupancy.available++;
    }

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
    const billedAmount = sum(currentFees.map((fee) => Number(fee.totalPayable)));
    const collectionRate =
      currentFees.length && billedAmount > 0
        ? Number(((monthlyRevenue / billedAmount) * 100).toFixed(1))
        : 0;

    // ── MRR + plan mix (owner-scoped, same amortization/lapse rule as the
    // admin dashboard): yearly plans amortize over 12 months, ACTIVE rows
    // whose endDate already passed are lapsed re-activation targets — not
    // revenue.
    const activePlans = activePlanRows.filter(
      (subscription) =>
        !subscription.endDate || new Date(subscription.endDate).getTime() >= now.getTime(),
    );
    const mrr = activePlans.reduce((total, subscription) => {
      const price = Number(subscription.price) || 0;
      return total + (subscription.billingCycle === BillingCycle.YEARLY ? price / 12 : price);
    }, 0);
    const activePlanCount = activePlans.length;
    const paidPlanCount = activePlans.filter(
      (subscription) => Number(subscription.price) > 0,
    ).length;
    const freePlanCount = activePlanCount - paidPlanCount;
    const lapsedPlanCount = activePlanRows.length - activePlanCount;
    const planMixTotal = activePlanRows.length;
    const percent = (count: number) =>
      planMixTotal ? Number(((count / planMixTotal) * 100).toFixed(1)) : 0;
    const ownerWidePlan = activePlanRows.some((subscription) => !subscription.hostelId);
    const coveredHostelIds = new Set(
      activePlanRows
        .map((subscription) => subscription.hostelId)
        .filter((hostelId): hostelId is string => Boolean(hostelId)),
    );
    const hostelsOnPlans = ownerWidePlan
      ? hostels.length
      : hostels.filter((hostel) => coveredHostelIds.has(hostel.id)).length;

    // ── All-time finance + fee lifecycle: every fee row for the owner's
    // hostels, not just this month's.
    const allTimeCollected = sum(fees.map((fee) => Number(fee.paidAmount)));
    const allTimeOutstanding = sum(fees.map(outstanding));
    const feeLifecycle = {
      total: fees.length,
      paid: fees.filter((fee) => fee.status === FeeStatus.PAID).length,
      pending: fees.filter((fee) => fee.status === FeeStatus.PENDING).length,
      overdue: fees.filter((fee) => fee.status === FeeStatus.OVERDUE).length,
      partiallyPaid: fees.filter((fee) => fee.status === FeeStatus.PARTIALLY_PAID).length,
    };

    // ── Occupancy per hostel: bed inventory first, room-capacity fallback —
    // the same rule as the totals above — plus the active resident count, so
    // the same array feeds the "Occupancy by hostel" chart and the
    // "Top hostels by residents" table.
    const bedsByHostel = new Map<string, { total: number; occupied: number; available: number }>();
    for (const bed of beds) {
      const counts = bedsByHostel.get(bed.hostelId) ?? { total: 0, occupied: 0, available: 0 };
      counts.total++;
      if (bed.status === BedStatus.OCCUPIED) counts.occupied++;
      if (bed.status === BedStatus.AVAILABLE) counts.available++;
      bedsByHostel.set(bed.hostelId, counts);
    }
    const activeResidentsByHostel = new Map<string, number>();
    for (const resident of residents) {
      if (!resident.isActive) continue;
      activeResidentsByHostel.set(
        resident.hostelId,
        (activeResidentsByHostel.get(resident.hostelId) ?? 0) + 1,
      );
    }
    const occupancyByHostel = hostels.map((hostel) => {
      const hostelBeds = bedsByHostel.get(hostel.id);
      const hasHostelBeds = (hostelBeds?.total ?? 0) > 0;
      const hostelRooms = rooms.filter((room) => room.hostelId === hostel.id);
      const total = hasHostelBeds
        ? hostelBeds!.total
        : sum(hostelRooms.map((room) => room.capacity));
      const occupied = hasHostelBeds
        ? hostelBeds!.occupied
        : sum(hostelRooms.map((room) => Math.min(room.occupied, room.capacity)));
      const available = hasHostelBeds ? hostelBeds!.available : Math.max(0, total - occupied);
      return {
        hostelId: hostel.id,
        hostelName: hostel.name,
        city: hostel.city,
        totalBeds: total,
        occupiedBeds: occupied,
        availableBeds: available,
        occupancyRate: total ? Number(((occupied / total) * 100).toFixed(1)) : 0,
        residents: activeResidentsByHostel.get(hostel.id) ?? 0,
      };
    });
    const topHostelsByResidents = [...occupancyByHostel]
      .sort((a, b) => b.residents - a.residents)
      .slice(0, 5)
      .map(({ hostelId, hostelName: name, city, residents }) => ({
        hostelId,
        name,
        city,
        residents,
      }));

    return {
      // ── Headline cards ────────────────────────────────────────────────────
      hostels: hostels.length, // "How big?" / "Total Hostels"
      activeResidents, // "Total Residents"
      generatedAt: now.toISOString(),

      // ── Hostel filter dropdown ───────────────────────────────────────────
      hostelOptions: hostels,

      // ── Occupancy: "How full?" / "Occupied Beds" card ────────────────────
      occupancy: {
        totalBeds,
        occupiedBeds,
        availableBeds,
        occupancyRate,
        source: hasBedInventory ? 'beds' : 'rooms',
      },

      // ── Finance ──────────────────────────────────────────────────────────
      finance: {
        // All-time: "Collected?" and "Outstanding?" headline cards.
        allTime: {
          collected: allTimeCollected,
          outstanding: allTimeOutstanding,
        },
        // This month: collection-rate badge + platform-revenue chart y-axis.
        thisMonth: {
          billed: billedAmount,
          collected: monthlyRevenue,
          pending: pendingAmount,
          collectionRate,
        },
      },

      // ── Payment status: this month's fees, split per fee status ──────────
      paymentStatus: {
        billed: billedAmount,
        collected: monthlyRevenue,
        pending: pendingAmount,
        collectionRate,
        breakdown: paymentStatus,
      },

      // ── MRR + plan mix ────────────────────────────────────────────────────
      mrr: {
        amount: Number(mrr.toFixed(2)),
        currency: 'NPR',
        basis: 'activeSubscriptions',
        paidPlans: paidPlanCount,
        freePlans: freePlanCount,
        lapsedPlans: lapsedPlanCount,
      },
      planMix: {
        hostelsOnPlans,
        paid: paidPlanCount,
        free: freePlanCount,
        lapsed: lapsedPlanCount,
        paidPercent: percent(paidPlanCount),
        freePercent: percent(freePlanCount),
        lapsedPercent: percent(lapsedPlanCount),
      },

      // ── Fee lifecycle chart ───────────────────────────────────────────────
      feeLifecycle,

      // ── Charts ───────────────────────────────────────────────────────────
      trends: { revenue: revenueTrend, residentGrowth },

      // ── Tables ────────────────────────────────────────────────────────────
      occupancyByHostel,
      topHostelsByResidents,
    };
  }

  private emptyOwnerSummary() {
    return {
      hostels: 0,
      activeResidents: 0,
      generatedAt: new Date().toISOString(),
      hostelOptions: [],
      occupancy: {
        totalBeds: 0,
        occupiedBeds: 0,
        availableBeds: 0,
        occupancyRate: 0,
        source: 'beds' as const,
      },
      finance: {
        allTime: { collected: 0, outstanding: 0 },
        thisMonth: { billed: 0, collected: 0, pending: 0, collectionRate: 0 },
      },
      paymentStatus: { billed: 0, collected: 0, pending: 0, collectionRate: 0, breakdown: [] },
      mrr: {
        amount: 0,
        currency: 'NPR',
        basis: 'activeSubscriptions',
        paidPlans: 0,
        freePlans: 0,
        lapsedPlans: 0,
      },
      planMix: {
        hostelsOnPlans: 0,
        paid: 0,
        free: 0,
        lapsed: 0,
        paidPercent: 0,
        freePercent: 0,
        lapsedPercent: 0,
      },
      feeLifecycle: { total: 0, paid: 0, pending: 0, overdue: 0, partiallyPaid: 0 },
      trends: { revenue: [], residentGrowth: [] },
      occupancyByHostel: [],
      topHostelsByResidents: [],
    };
  }
}
