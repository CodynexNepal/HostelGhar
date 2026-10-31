"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsRepository = void 0;
const database_source_1 = require("../../database/database-source");
const user_entity_1 = require("../../entities/user.entity");
const hostel_entity_1 = require("../../entities/hostel/hostel.entity");
const resident_entity_1 = require("../../entities/resident/resident.entity");
const booking_entity_1 = require("../../entities/booking/booking.entity");
const fee_entity_1 = require("../../entities/fee/fee.entity");
const leave_request_entity_1 = require("../../entities/leave/leave-request.entity");
const room_entity_1 = require("../../entities/room/room.entity");
const bed_entity_1 = require("../../entities/bed/bed.entity");
const fee_enum_1 = require("../../enum/fee.enum");
const leave_enum_1 = require("../../enum/leave.enum");
const booking_enum_1 = require("../../enum/booking.enum");
const bed_enum_1 = require("../../enum/bed.enum");
const subscription_entity_1 = require("../../entities/subscription/subscription.entity");
const subscription_enum_1 = require("../../enum/subscription.enum");
const payment_entity_1 = require("../../entities/payment/payment.entity");
const payment_enum_1 = require("../../enum/payment.enum");
const roles_enum_1 = require("../../enum/roles.enum");
const typeorm_1 = require("typeorm");
class AnalyticsRepository {
    /**
     * Admin dashboard bootstrap: one call powers every card on
     * `/admin/dashboard` (top stats, pending approvals, hostels spotlight and
     * platform health). The legacy `getAdminSummary()` fields are still returned
     * at the top level so clients already on this endpoint keep working.
     *
     * Every metric is a COUNT/SUM aggregate issued in parallel — never a per-row
     * `find()` — so the dashboard stays a fixed number of round-trips.
     */
    async getAdminDashboard(spotlightLimit = 5) {
        const userRepo = database_source_1.AppDataSource.getRepository(user_entity_1.User);
        const hostelRepo = database_source_1.AppDataSource.getRepository(hostel_entity_1.Hostel);
        const residentRepo = database_source_1.AppDataSource.getRepository(resident_entity_1.Resident);
        const bookingRepo = database_source_1.AppDataSource.getRepository(booking_entity_1.Booking);
        const feeRepo = database_source_1.AppDataSource.getRepository(fee_entity_1.Fee);
        const leaveRepo = database_source_1.AppDataSource.getRepository(leave_request_entity_1.LeaveRequest);
        const roomRepo = database_source_1.AppDataSource.getRepository(room_entity_1.Room);
        const bedRepo = database_source_1.AppDataSource.getRepository(bed_entity_1.Bed);
        const subscriptionRepo = database_source_1.AppDataSource.getRepository(subscription_entity_1.Subscription);
        const paymentRepo = database_source_1.AppDataSource.getRepository(payment_entity_1.Payment);
        const now = new Date();
        const currentMonth = now.getUTCMonth() + 1;
        const currentYear = now.getUTCFullYear();
        // The 12-month window start (inclusive): one year ago, month-aligned.
        const trendStartYear = currentMonth === 12 ? currentYear : currentYear - 1;
        const trendStartMonth = currentMonth === 12 ? 1 : currentMonth + 1;
        const [users, hostels, activeResidents, pendingBookings, pendingLeaves, unpaidFees, pendingSubscriptionRequests, activePlanRows, revenue, monthRevenue, roomInventory, bedInventory, recentHostels, hostelBedRows, hostelResidentRows, feeLifecycleRows, revenueTrendRows, allHostels, totalOwners, totalStudents, overdueFeesRaw, paymentMethodRows, dailyRevenueRows, hostelDuesRows, hostelRevenueRows, studentGrowthRows, hostelRegistrationTrends, studentDuesCounts,] = await Promise.all([
            userRepo.count(),
            hostelRepo.count(),
            residentRepo.count({ where: { isActive: true } }),
            bookingRepo.count({ where: { status: booking_enum_1.BookingStatus.PENDING } }),
            leaveRepo.count({ where: { status: leave_enum_1.LeaveStatus.PENDING } }),
            feeRepo.count({ where: { status: fee_enum_1.FeeStatus.PENDING } }),
            subscriptionRepo.count({ where: { status: subscription_enum_1.SubscriptionStatus.PENDING } }),
            // MRR + active plans: one row per active plan, not an N+1 per owner.
            subscriptionRepo.find({
                where: { status: subscription_enum_1.SubscriptionStatus.ACTIVE },
                select: { id: true, price: true, billingCycle: true, endDate: true },
            }),
            feeRepo
                .createQueryBuilder('fee')
                .select('COALESCE(SUM(fee.paidAmount), 0)', 'paid')
                .addSelect('COALESCE(SUM(fee.totalPayable - fee.discountAmount - fee.paidAmount), 0)', 'outstanding')
                .getRawOne(),
            feeRepo
                .createQueryBuilder('fee')
                .select('COALESCE(SUM(fee.paidAmount), 0)', 'paid')
                .addSelect('COALESCE(SUM(fee.totalPayable), 0)', 'billed')
                .where('fee.billingMonth = :month', { month: currentMonth })
                .andWhere('fee.billingYear = :year', { year: currentYear })
                .getRawOne(),
            roomRepo
                .createQueryBuilder('room')
                .select('COUNT(*)', 'rooms')
                .addSelect('COALESCE(SUM(room.capacity), 0)', 'capacity')
                .addSelect('COALESCE(SUM(room.occupied), 0)', 'occupied')
                .getRawOne(),
            bedRepo
                .createQueryBuilder('bed')
                .select('COUNT(*)', 'total')
                .addSelect("COUNT(*) FILTER (WHERE bed.status = 'OCCUPIED')", 'occupied')
                .getRawOne(),
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
                .getRawMany(),
            // Per-hostel active resident count (GROUP BY) — powers "Top hostels by residents" table.
            residentRepo
                .createQueryBuilder('resident')
                .select('resident.hostelId', 'hostelId')
                .addSelect('COUNT(*)', 'count')
                .where('resident.isActive = :active', { active: true })
                .groupBy('resident.hostelId')
                .getRawMany(),
            // Fee lifecycle counts by status (all-time) — powers the fee lifecycle chart.
            feeRepo
                .createQueryBuilder('fee')
                .select('fee.status', 'status')
                .addSelect('COUNT(*)', 'count')
                .groupBy('fee.status')
                .getRawMany(),
            // 12-month revenue trend — one row per billing month in the window.
            feeRepo
                .createQueryBuilder('fee')
                .select('fee.billingYear', 'year')
                .addSelect('fee.billingMonth', 'month')
                .addSelect('COALESCE(SUM(fee.paidAmount), 0)', 'collected')
                .addSelect('COALESCE(SUM(fee.totalPayable), 0)', 'billed')
                .where(
            // Include rows from trendStartYear/Month onwards (12-month window).
            '(fee.billingYear > :sy OR (fee.billingYear = :sy AND fee.billingMonth >= :sm))', { sy: trendStartYear, sm: trendStartMonth })
                .groupBy('fee.billingYear')
                .addGroupBy('fee.billingMonth')
                .orderBy('fee.billingYear', 'ASC')
                .addOrderBy('fee.billingMonth', 'ASC')
                .getRawMany(),
            // All hostels (lean: id + name + city) — for occupancyByHostel entries.
            hostelRepo.find({
                select: { id: true, name: true, city: true },
                order: { name: 'ASC' },
            }),
            // 1. Total registered Owners
            userRepo.count({ where: { role: roles_enum_1.IROLES.OWNER } }),
            // 2. Total registered Students
            residentRepo.count(),
            // 3. Overdue Amount
            feeRepo
                .createQueryBuilder('fee')
                .select('COALESCE(SUM(GREATEST(0, fee.totalPayable - fee.discountAmount - fee.paidAmount)), 0)', 'overdue')
                .where("fee.status != 'CANCELLED'")
                .andWhere('fee.dueDate < CURRENT_DATE')
                .getRawOne(),
            // 4. Payment Methods Distribution
            paymentRepo
                .createQueryBuilder('p')
                .select('p.paymentMethod', 'method')
                .addSelect('COUNT(*)', 'count')
                .addSelect('COALESCE(SUM(p.amount), 0)', 'amount')
                .where('p.paymentStatus = :status', { status: payment_enum_1.PaymentStatus.SUCCESS })
                .groupBy('p.paymentMethod')
                .getRawMany(),
            // 5. Daily Revenue (last 30 days)
            paymentRepo
                .createQueryBuilder('p')
                .select("TO_CHAR(p.paidAt, 'YYYY-MM-DD')", 'date')
                .addSelect('COALESCE(SUM(p.amount), 0)', 'amount')
                .where('p.paymentStatus = :status', { status: payment_enum_1.PaymentStatus.SUCCESS })
                .andWhere("p.paidAt >= CURRENT_DATE - INTERVAL '30 days'")
                .groupBy("TO_CHAR(p.paidAt, 'YYYY-MM-DD')")
                .orderBy('date', 'ASC')
                .getRawMany(),
            // 6. Hostels with Highest Outstanding Dues
            feeRepo
                .createQueryBuilder('fee')
                .leftJoin('fee.hostel', 'hostel')
                .select('fee.hostelId', 'hostelId')
                .addSelect('hostel.name', 'name')
                .addSelect('COALESCE(SUM(GREATEST(0, fee.totalPayable - fee.discountAmount - fee.paidAmount)), 0)', 'outstanding')
                .addSelect('COALESCE(SUM(CASE WHEN fee.dueDate < CURRENT_DATE THEN GREATEST(0, fee.totalPayable - fee.discountAmount - fee.paidAmount) ELSE 0 END), 0)', 'overdue')
                .where("fee.status != 'CANCELLED'")
                .groupBy('fee.hostelId')
                .addGroupBy('hostel.name')
                .orderBy('outstanding', 'DESC')
                .take(10)
                .getRawMany(),
            // 7. Top Revenue Hostels
            feeRepo
                .createQueryBuilder('fee')
                .leftJoin('fee.hostel', 'hostel')
                .select('fee.hostelId', 'hostelId')
                .addSelect('hostel.name', 'name')
                .addSelect('COALESCE(SUM(fee.paidAmount), 0)', 'collected')
                .groupBy('fee.hostelId')
                .addGroupBy('hostel.name')
                .orderBy('collected', 'DESC')
                .take(10)
                .getRawMany(),
            // 8. Student Growth Trends (12 months)
            residentRepo
                .createQueryBuilder('resident')
                .select("TO_CHAR(resident.createdAt, 'YYYY-MM')", 'period')
                .addSelect('COUNT(*)', 'count')
                .where("resident.createdAt >= CURRENT_DATE - INTERVAL '12 months'")
                .groupBy("TO_CHAR(resident.createdAt, 'YYYY-MM')")
                .orderBy('period', 'ASC')
                .getRawMany(),
            // 9. Hostel Registration Trends (12 months)
            hostelRepo
                .createQueryBuilder('hostel')
                .select("TO_CHAR(hostel.createdAt, 'YYYY-MM')", 'period')
                .addSelect('COUNT(*)', 'count')
                .where("hostel.createdAt >= CURRENT_DATE - INTERVAL '12 months'")
                .groupBy("TO_CHAR(hostel.createdAt, 'YYYY-MM')")
                .orderBy('period', 'ASC')
                .getRawMany(),
            // 10. Students with Dues / Overdue Count
            feeRepo
                .createQueryBuilder('fee')
                .select('COUNT(DISTINCT fee.residentId) FILTER (WHERE GREATEST(0, fee.totalPayable - fee.discountAmount - fee.paidAmount) > 0)', 'withDues')
                .addSelect('COUNT(DISTINCT fee.residentId) FILTER (WHERE fee.dueDate < CURRENT_DATE AND GREATEST(0, fee.totalPayable - fee.discountAmount - fee.paidAmount) > 0)', 'withOverdue')
                .where("fee.status != 'CANCELLED'")
                .getRawOne(),
        ]);
        // ── MRR: yearly plans are billed up-front, so amortize them over 12 months
        // to keep the headline number a true *monthly* recurring revenue figure.
        // ACTIVE rows whose endDate already lapsed are excluded from both totals.
        const activePlans = activePlanRows.filter((subscription) => !subscription.endDate || new Date(subscription.endDate).getTime() >= now.getTime());
        const mrr = activePlans.reduce((total, subscription) => {
            const price = Number(subscription.price) || 0;
            return total + (subscription.billingCycle === subscription_enum_1.BillingCycle.YEARLY ? price / 12 : price);
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
        const overdueDues = Math.max(0, Number(overdueFeesRaw?.overdue || 0));
        const monthlyRevenue = Number(monthRevenue?.paid || 0);
        const monthlyBilled = Number(monthRevenue?.billed || 0);
        const collectionRate = monthlyBilled
            ? Number(((monthlyRevenue / monthlyBilled) * 100).toFixed(1))
            : 0;
        // Payment methods distribution
        const paymentMethodsList = (paymentMethodRows || []).map((row) => ({
            method: row.method,
            count: Number(row.count || 0),
            amount: Number(row.amount || 0),
        }));
        const cashMethod = paymentMethodsList.find((p) => p.method === 'CASH');
        const cashAmount = cashMethod?.amount ?? 0;
        const onlineAmount = paymentMethodsList
            .filter((p) => p.method !== 'CASH')
            .reduce((s, p) => s + p.amount, 0);
        // ── planMix: paid/free/lapsed percentages (same formula as owner analytics).
        const planMixTotal = activePlanRows.length;
        const pct = (n) => (planMixTotal ? Number(((n / planMixTotal) * 100).toFixed(1)) : 0);
        // ── feeLifecycle: count per status (all-time).
        const lifecycleCount = (status) => Number(feeLifecycleRows.find((r) => r.status === status)?.count ?? 0);
        const feeLifecycle = {
            total: feeLifecycleRows.reduce((sum, r) => sum + Number(r.count), 0),
            paid: lifecycleCount(fee_enum_1.FeeStatus.PAID),
            pending: lifecycleCount(fee_enum_1.FeeStatus.PENDING),
            overdue: lifecycleCount(fee_enum_1.FeeStatus.OVERDUE),
            partiallyPaid: lifecycleCount(fee_enum_1.FeeStatus.PARTIALLY_PAID),
        };
        // ── trends.revenue: fill every month in the 12-month window, zeroing gaps.
        const monthKey = (y, m) => `${y}-${String(m).padStart(2, '0')}`;
        const trendMap = new Map(revenueTrendRows.map((r) => [
            monthKey(Number(r.year), Number(r.month)),
            { collected: Number(r.collected), billed: Number(r.billed) },
        ]));
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
        const bedByHostel = new Map(hostelBedRows.map((r) => [
            r.hostelId,
            { total: Number(r.total), occupied: Number(r.occupied), available: Number(r.available) },
        ]));
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
        const activeHostelsCount = occupancyByHostel.filter((h) => h.residents > 0).length;
        const topHostelsByResidents = occupancyByHostel
            .slice(0, 5)
            .map(({ hostelId, hostelName: name, city, residents }) => ({
            hostelId,
            name,
            city,
            residents,
        }));
        return {
            // ── Main KPI Cards (Requirement 4.A)
            totalHostels: hostels,
            totalStudents: activeResidents,
            totalRegisteredStudents: totalStudents,
            totalOwners,
            totalRevenueCollected: totalRevenue,
            totalRevenue,
            paidAmount: totalRevenue,
            outstandingAmount: pendingDues,
            pendingAmount: pendingDues,
            overdueAmount: overdueDues,
            overduePayments: overdueDues,
            totalActiveResidents: activeResidents,
            mrr: Number(mrr.toFixed(2)),
            // ── Legacy fields, unchanged shape, for clients already on this endpoint.
            users,
            hostels,
            activeResidents,
            pendingBookings,
            pendingLeaves,
            unpaidFees,
            // ── Meta ─────────────────────────────────────────────────────────────
            generatedAt: now.toISOString(),
            // ── Headline stat cards ───────────────────────────────────────────────
            stats: {
                totalHostels: hostels,
                totalStudents: activeResidents,
                totalRegisteredStudents: totalStudents,
                totalOwners,
                totalRevenueCollected: totalRevenue,
                outstandingAmount: pendingDues,
                overdueAmount: overdueDues,
                totalResidents: activeResidents,
                mrr: Number(mrr.toFixed(2)),
                mrrBasis: 'activeSubscriptions',
                mrrCurrency: 'NPR',
                mrrPaidPlans: paidPlans.length,
                mrrFreePlans: freePlans,
                mrrLapsedPlans: lapsedPlans,
                occupancy: { totalBeds, occupiedBeds, availableBeds, rate: occupancyRate },
            },
            // ── Daily Revenue & Payment Methods (Requirement 4.B)
            dailyRevenue: (dailyRevenueRows || []).map((r) => ({
                date: r.date,
                amount: Number(r.amount || 0),
            })),
            revenueByHostel: (hostelRevenueRows || []).map((h) => ({
                hostelId: h.hostelId,
                name: h.name,
                collected: Number(h.collected || 0),
            })),
            paymentMethods: {
                breakdown: paymentMethodsList,
                cashAmount,
                onlineAmount,
                cashCount: cashMethod?.count ?? 0,
                onlineCount: paymentMethodsList
                    .filter((p) => p.method !== 'CASH')
                    .reduce((s, p) => s + p.count, 0),
                cashPercent: totalRevenue ? Number(((cashAmount / totalRevenue) * 100).toFixed(1)) : 0,
                onlinePercent: totalRevenue ? Number(((onlineAmount / totalRevenue) * 100).toFixed(1)) : 0,
            },
            // ── Hostel Analytics (Requirement 4.C)
            hostelsAnalytics: {
                topPerforming: (hostelRevenueRows || []).slice(0, 5).map((h) => ({
                    hostelId: h.hostelId,
                    name: h.name,
                    collected: Number(h.collected || 0),
                })),
                highestOutstanding: (hostelDuesRows || []).slice(0, 5).map((h) => ({
                    hostelId: h.hostelId,
                    name: h.name,
                    outstanding: Number(h.outstanding || 0),
                    overdue: Number(h.overdue || 0),
                })),
                activeHostels: activeHostelsCount,
                inactiveHostels: Math.max(0, hostels - activeHostelsCount),
                studentDistribution: occupancyByHostel.map((h) => ({
                    hostelId: h.hostelId,
                    name: h.hostelName,
                    city: h.city,
                    residents: h.residents,
                    percentage: activeResidents
                        ? Number(((h.residents / activeResidents) * 100).toFixed(1))
                        : 0,
                })),
                registrationTrends: (hostelRegistrationTrends || []).map((t) => ({
                    period: t.period,
                    count: Number(t.count || 0),
                })),
            },
            // ── Student Analytics (Requirement 4.D)
            studentAnalytics: {
                totalActive: activeResidents,
                totalRegistered: totalStudents,
                withOutstandingBalance: Number(studentDuesCounts?.withDues || 0),
                withOverdueBalance: Number(studentDuesCounts?.withOverdue || 0),
                growthTrends: (studentGrowthRows || []).map((t) => ({
                    period: t.period,
                    count: Number(t.count || 0),
                })),
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
    async getOwnerSummary(ownerId) {
        const hostels = await database_source_1.AppDataSource.getRepository(hostel_entity_1.Hostel).find({
            where: { ownerId },
            select: { id: true, name: true, city: true, address: true },
            order: { name: 'ASC' },
        });
        const hostelIds = hostels.map((hostel) => hostel.id);
        if (!hostelIds.length) {
            return this.emptyOwnerSummary();
        }
        const [residents, rooms, beds, fees, activePlanRows] = await Promise.all([
            database_source_1.AppDataSource.getRepository(resident_entity_1.Resident).find({
                where: { hostelId: (0, typeorm_1.In)(hostelIds) },
                select: { id: true, hostelId: true, isActive: true, createdAt: true },
            }),
            database_source_1.AppDataSource.getRepository(room_entity_1.Room).find({
                where: { hostelId: (0, typeorm_1.In)(hostelIds) },
                select: {
                    id: true,
                    hostelId: true,
                    capacity: true,
                    occupied: true,
                },
            }),
            database_source_1.AppDataSource.getRepository(bed_entity_1.Bed).find({
                where: { hostelId: (0, typeorm_1.In)(hostelIds) },
                select: { id: true, hostelId: true, roomId: true, status: true },
            }),
            database_source_1.AppDataSource.getRepository(fee_entity_1.Fee).find({
                where: { hostelId: (0, typeorm_1.In)(hostelIds) },
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
            database_source_1.AppDataSource.getRepository(subscription_entity_1.Subscription).find({
                where: { ownerId, status: subscription_enum_1.SubscriptionStatus.ACTIVE },
                select: { id: true, hostelId: true, price: true, billingCycle: true, endDate: true },
            }),
        ]);
        const now = new Date();
        const currentMonth = now.getUTCMonth() + 1;
        const currentYear = now.getUTCFullYear();
        const activeResidents = residents.filter((resident) => resident.isActive).length;
        const currentFees = fees.filter((fee) => fee.billingMonth === currentMonth && fee.billingYear === currentYear);
        const outstanding = (fee) => Math.max(0, Number(fee.totalPayable) - Number(fee.paidAmount));
        const sum = (values) => values.reduce((total, value) => total + value, 0);
        const bedCounts = {
            occupied: beds.filter((bed) => bed.status === bed_enum_1.BedStatus.OCCUPIED).length,
            reserved: beds.filter((bed) => bed.status === bed_enum_1.BedStatus.RESERVED).length,
            available: beds.filter((bed) => bed.status === bed_enum_1.BedStatus.AVAILABLE).length,
            maintenance: beds.filter((bed) => bed.status === bed_enum_1.BedStatus.MAINTENANCE).length,
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
        const bedsByRoom = new Map();
        for (const bed of beds) {
            const counts = bedsByRoom.get(bed.roomId) ?? {
                occupied: 0,
                reserved: 0,
                available: 0,
                maintenance: 0,
            };
            if (bed.status === bed_enum_1.BedStatus.OCCUPIED)
                counts.occupied++;
            if (bed.status === bed_enum_1.BedStatus.RESERVED)
                counts.reserved++;
            if (bed.status === bed_enum_1.BedStatus.AVAILABLE)
                counts.available++;
            if (bed.status === bed_enum_1.BedStatus.MAINTENANCE)
                counts.maintenance++;
            bedsByRoom.set(bed.roomId, counts);
        }
        const roomOccupancy = { fullyOccupied: 0, partiallyOccupied: 0, available: 0, maintenance: 0 };
        for (const room of rooms) {
            const counts = bedsByRoom.get(room.id);
            const occupied = counts?.occupied ?? Math.min(room.occupied, room.capacity);
            const maintenance = counts?.maintenance ?? 0;
            if (maintenance === room.capacity && room.capacity > 0)
                roomOccupancy.maintenance++;
            else if (occupied >= room.capacity && room.capacity > 0)
                roomOccupancy.fullyOccupied++;
            else if (occupied > 0)
                roomOccupancy.partiallyOccupied++;
            else
                roomOccupancy.available++;
        }
        const paymentStatus = Object.values(fee_enum_1.FeeStatus).map((status) => {
            const statusFees = currentFees.filter((fee) => fee.status === status);
            return {
                status,
                count: statusFees.length,
                billed: sum(statusFees.map((fee) => Number(fee.totalPayable))),
                paid: sum(statusFees.map((fee) => Number(fee.paidAmount))),
                outstanding: sum(statusFees.map(outstanding)),
            };
        });
        const monthKey = (date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
        const lastTwelveMonths = Array.from({ length: 12 }, (_, index) => {
            const date = new Date(Date.UTC(currentYear, currentMonth - 12 + index, 1));
            return { key: monthKey(date), year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
        });
        const revenueTrend = lastTwelveMonths.map(({ key, year, month }) => {
            const periodFees = fees.filter((fee) => fee.billingYear === year && fee.billingMonth === month);
            return {
                period: key,
                billed: sum(periodFees.map((fee) => Number(fee.totalPayable))),
                collected: sum(periodFees.map((fee) => Number(fee.paidAmount))),
                pending: sum(periodFees.map(outstanding)),
            };
        });
        const residentGrowth = lastTwelveMonths.map(({ key, year, month }) => ({
            period: key,
            joined: residents.filter((resident) => resident.createdAt.getUTCFullYear() === year &&
                resident.createdAt.getUTCMonth() + 1 === month).length,
        }));
        const monthlyRevenue = sum(currentFees.map((fee) => Number(fee.paidAmount)));
        const pendingAmount = sum(currentFees.map(outstanding));
        const billedAmount = sum(currentFees.map((fee) => Number(fee.totalPayable)));
        const collectionRate = currentFees.length && billedAmount > 0
            ? Number(((monthlyRevenue / billedAmount) * 100).toFixed(1))
            : 0;
        // ── MRR + plan mix (owner-scoped, same amortization/lapse rule as the
        // admin dashboard): yearly plans amortize over 12 months, ACTIVE rows
        // whose endDate already passed are lapsed re-activation targets — not
        // revenue.
        const activePlans = activePlanRows.filter((subscription) => !subscription.endDate || new Date(subscription.endDate).getTime() >= now.getTime());
        const mrr = activePlans.reduce((total, subscription) => {
            const price = Number(subscription.price) || 0;
            return total + (subscription.billingCycle === subscription_enum_1.BillingCycle.YEARLY ? price / 12 : price);
        }, 0);
        const activePlanCount = activePlans.length;
        const paidPlanCount = activePlans.filter((subscription) => Number(subscription.price) > 0).length;
        const freePlanCount = activePlanCount - paidPlanCount;
        const lapsedPlanCount = activePlanRows.length - activePlanCount;
        const planMixTotal = activePlanRows.length;
        const percent = (count) => planMixTotal ? Number(((count / planMixTotal) * 100).toFixed(1)) : 0;
        const ownerWidePlan = activePlanRows.some((subscription) => !subscription.hostelId);
        const coveredHostelIds = new Set(activePlanRows
            .map((subscription) => subscription.hostelId)
            .filter((hostelId) => Boolean(hostelId)));
        const hostelsOnPlans = ownerWidePlan
            ? hostels.length
            : hostels.filter((hostel) => coveredHostelIds.has(hostel.id)).length;
        // ── All-time finance + fee lifecycle: every fee row for the owner's
        // hostels, not just this month's.
        const allTimeCollected = sum(fees.map((fee) => Number(fee.paidAmount)));
        const allTimeOutstanding = sum(fees.map(outstanding));
        const feeLifecycle = {
            total: fees.length,
            paid: fees.filter((fee) => fee.status === fee_enum_1.FeeStatus.PAID).length,
            pending: fees.filter((fee) => fee.status === fee_enum_1.FeeStatus.PENDING).length,
            overdue: fees.filter((fee) => fee.status === fee_enum_1.FeeStatus.OVERDUE).length,
            partiallyPaid: fees.filter((fee) => fee.status === fee_enum_1.FeeStatus.PARTIALLY_PAID).length,
        };
        // ── Occupancy per hostel: bed inventory first, room-capacity fallback —
        // the same rule as the totals above — plus the active resident count, so
        // the same array feeds the "Occupancy by hostel" chart and the
        // "Top hostels by residents" table.
        const bedsByHostel = new Map();
        for (const bed of beds) {
            const counts = bedsByHostel.get(bed.hostelId) ?? { total: 0, occupied: 0, available: 0 };
            counts.total++;
            if (bed.status === bed_enum_1.BedStatus.OCCUPIED)
                counts.occupied++;
            if (bed.status === bed_enum_1.BedStatus.AVAILABLE)
                counts.available++;
            bedsByHostel.set(bed.hostelId, counts);
        }
        const activeResidentsByHostel = new Map();
        for (const resident of residents) {
            if (!resident.isActive)
                continue;
            activeResidentsByHostel.set(resident.hostelId, (activeResidentsByHostel.get(resident.hostelId) ?? 0) + 1);
        }
        const occupancyByHostel = hostels.map((hostel) => {
            const hostelBeds = bedsByHostel.get(hostel.id);
            const hasHostelBeds = (hostelBeds?.total ?? 0) > 0;
            const hostelRooms = rooms.filter((room) => room.hostelId === hostel.id);
            const total = hasHostelBeds
                ? hostelBeds.total
                : sum(hostelRooms.map((room) => room.capacity));
            const occupied = hasHostelBeds
                ? hostelBeds.occupied
                : sum(hostelRooms.map((room) => Math.min(room.occupied, room.capacity)));
            const available = hasHostelBeds ? hostelBeds.available : Math.max(0, total - occupied);
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
    emptyOwnerSummary() {
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
                source: 'beds',
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
exports.AnalyticsRepository = AnalyticsRepository;
