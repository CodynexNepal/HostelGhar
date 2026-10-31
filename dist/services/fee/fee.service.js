"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: fee.service.ts
// PURPOSE: Automated Student Fee lifecycle & Monthly billing cron jobs.
//          - Generates monthly fee of 10500 + previous due amount
//          - Queues emails via BullMQ with Circuit Breaker
//          - Emits live WebSocket updates to residents and owners
//          - 3-tier caching & pagination for fee lookups
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.feeService = exports.FeeService = exports.resolveNepaliBillingPeriod = void 0;
const fee_enum_1 = require("../../enum/fee.enum");
const event_dispatcher_util_1 = require("../../utils/event-dispatcher.util");
const queue_constants_1 = require("../../constant/queue.constants");
const fee_repository_1 = require("../../repository/fee/fee.repository");
const statusCode_interface_1 = require("../../constant/statusCode.interface");
const cache_util_1 = require("../../utils/cache.util");
const pagination_util_1 = require("../../utils/pagination.util");
const email_template_1 = require("../../templates/email.template");
const fee_credit_util_1 = require("../../utils/fee-credit.util");
const socket_server_1 = require("../../socket/socket.server");
const nepali_date_util_1 = require("../../utils/nepali-date.util");
/**
 * Billing is stored on the AD calendar (billingMonth/billingYear/dueDate) so
 * existing reports keep working, but the whole cycle is keyed to the Nepali
 * 1st: the BS month/year become the customer-facing bill identity.
 */
const resolveNepaliBillingPeriod = (now = new Date()) => {
    const bs = (0, nepali_date_util_1.toNepaliDate)(now);
    const nepaliMonthLabel = (0, nepali_date_util_1.formatNepaliMonthYear)(bs);
    const nepaliDateLabel = (0, nepali_date_util_1.formatNepaliDate)({ year: bs.year, month: bs.month, day: 1 });
    const billingMonth = now.getMonth() + 1;
    const billingYear = now.getFullYear();
    const dueDate = `${billingYear}-${String(billingMonth).padStart(2, '0')}-07`;
    const dueDay = Math.min(7, (0, nepali_date_util_1.getBsMonthLength)(bs.year, bs.month));
    const dueDateBs = (0, nepali_date_util_1.formatNepaliDate)({ year: bs.year, month: bs.month, day: dueDay });
    return {
        bsYear: bs.year,
        bsMonth: bs.month,
        nepaliMonthLabel,
        nepaliDateLabel,
        billingMonth,
        billingYear,
        dueDate,
        dueDateBs,
    };
};
exports.resolveNepaliBillingPeriod = resolveNepaliBillingPeriod;
class FeeService {
    constructor(feeRepository = new fee_repository_1.FeeRepository()) {
        this.feeRepository = feeRepository;
    }
    /**
     * Generates monthly fee for all active residents across all hostels.
     * Run automatically on the 1st day of every NEPALI month.
     * When `enforceNepaliFirstDay` is true (scheduler path), the run is skipped
     * unless today is Baishakh 1, Jestha 1, ... (gatey).
     */
    async generateMonthlyFeesForAllHostels(billingMonth, billingYear, baseFee = 10500.0, options = {}) {
        const now = options.now ?? new Date();
        if (options.enforceNepaliFirstDay && !(0, nepali_date_util_1.isFirstDayOfNepaliMonth)(now)) {
            return { generatedCount: 0, errors: 0, skipped: true };
        }
        const period = (0, exports.resolveNepaliBillingPeriod)(now);
        const resolvedMonth = billingMonth ?? period.billingMonth;
        const resolvedYear = billingYear ?? period.billingYear;
        const dueDate = `${resolvedYear}-${String(resolvedMonth).padStart(2, '0')}-07`;
        console.log(`🏦 [FeeService] Starting Nepali monthly fee automation for ${period.nepaliMonthLabel} (AD ${resolvedMonth}/${resolvedYear})${options.hostelId ? ` for hostel ${options.hostelId}` : ''}...`);
        // Stream/batch active residents with user details and hostel owner details in a single query
        const activeResidents = await this.feeRepository.findActiveResidents(options.hostelId);
        if (activeResidents.length === 0) {
            return { generatedCount: 0, errors: 0, nepaliMonth: period.nepaliMonthLabel, emailsDispatched: 0 };
        }
        const residentIds = activeResidents.map((r) => r.id);
        // 1. Single batch query for already-generated monthly fees in this period (prevents N lookups)
        const existingFees = await this.feeRepository.findExistingMonthlyFees(residentIds, resolvedMonth, resolvedYear);
        const alreadyBilledSet = new Set(existingFees.map((f) => f.residentId));
        // 2. Filter out residents who have already been billed for this cycle
        const unbilledResidents = activeResidents.filter((r) => !alreadyBilledSet.has(r.id));
        if (unbilledResidents.length === 0) {
            console.log(`🏦 [FeeService] All active residents already billed for ${period.nepaliMonthLabel}.`);
            if (options.resendEmails) {
                const existingMap = new Map(existingFees.map((f) => [f.residentId, f]));
                const resendJobs = [];
                for (const resident of activeResidents) {
                    const fee = existingMap.get(resident.id);
                    if (!fee || !resident.user?.email)
                        continue;
                    const ownerName = `${resident.hostel?.owner?.firstName || ''} ${resident.hostel?.owner?.lastName || ''}`.trim() ||
                        'Hostel Owner';
                    const studentName = `${resident.user?.firstName || ''} ${resident.user?.lastName || ''}`.trim() || 'Student';
                    const bill = (0, email_template_1.renderMonthlyFeeBillEmail)({
                        studentName,
                        studentEmail: resident.user?.email,
                        hostelName: resident.hostel?.name || 'Hostel',
                        ownerName,
                        hostelAddress: resident.hostel?.address || '',
                        hostelPhone: resident.hostel?.phone || '',
                        hostelEmail: resident.hostel?.email || '',
                        roomNumber: resident.roomNumber,
                        nepaliMonthLabel: period.nepaliMonthLabel,
                        nepaliDateLabel: period.nepaliDateLabel,
                        baseFee: Number(fee.amount ?? baseFee),
                        outstandingDue: Number(fee.dueAmount ?? 0),
                        totalPayable: Number(fee.totalPayable ?? baseFee),
                        dueDateAd: fee.dueDate || dueDate,
                        dueDateBs: period.dueDateBs,
                        billNo: `FEE-${resolvedYear}${String(resolvedMonth).padStart(2, '0')}`,
                    });
                    resendJobs.push({
                        name: queue_constants_1.JobType.SEND_INVOICE_EMAIL,
                        data: {
                            to: resident.user.email,
                            subject: bill.subject,
                            body: bill.body,
                            html: bill.html,
                        },
                    });
                }
                if (resendJobs.length > 0) {
                    try {
                        await event_dispatcher_util_1.eventDispatcher.queueEmailsBulk(resendJobs, { timeoutMs: 10000 });
                    }
                    catch (err) {
                        console.warn('⚠️ [FeeService] Resend bulk email dispatch warning:', err.message);
                    }
                }
                return {
                    generatedCount: 0,
                    errors: 0,
                    nepaliMonth: period.nepaliMonthLabel,
                    emailsDispatched: resendJobs.length,
                    message: `All active residents were already billed. Resent ${resendJobs.length} bill email(s).`,
                };
            }
            return { generatedCount: 0, errors: 0, nepaliMonth: period.nepaliMonthLabel, emailsDispatched: 0 };
        }
        // 3. Single aggregate query for all pending/unpaid balances (eliminates N balance queries)
        const unbilledResidentIds = unbilledResidents.map((r) => r.id);
        const balances = await this.feeRepository.findPendingBalancesByResidents(unbilledResidentIds);
        const feesToCreate = [];
        const emailJobs = [];
        const socketNotifications = [];
        for (const resident of unbilledResidents) {
            const outstandingDue = balances.get(resident.id) || 0.0;
            const totalPayable = Number(baseFee) + Number(outstandingDue);
            feesToCreate.push({
                residentId: resident.id,
                hostelId: resident.hostelId,
                feeType: fee_enum_1.FeeType.MONTHLY_HOSTEL_FEE,
                amount: baseFee,
                dueAmount: outstandingDue,
                totalPayable,
                paidAmount: 0.0,
                billingMonth: resolvedMonth,
                billingYear: resolvedYear,
                dueDate,
                status: fee_enum_1.FeeStatus.PENDING,
            });
            const ownerName = `${resident.hostel?.owner?.firstName || ''} ${resident.hostel?.owner?.lastName || ''}`.trim() ||
                'Hostel Owner';
            const studentName = `${resident.user?.firstName || ''} ${resident.user?.lastName || ''}`.trim() || 'Student';
            const bill = (0, email_template_1.renderMonthlyFeeBillEmail)({
                studentName,
                studentEmail: resident.user?.email,
                hostelName: resident.hostel?.name || 'Hostel',
                ownerName,
                hostelAddress: resident.hostel?.address || '',
                hostelPhone: resident.hostel?.phone || '',
                hostelEmail: resident.hostel?.email || '',
                roomNumber: resident.roomNumber,
                nepaliMonthLabel: period.nepaliMonthLabel,
                nepaliDateLabel: period.nepaliDateLabel,
                baseFee: Number(baseFee),
                outstandingDue: Number(outstandingDue),
                totalPayable: Number(totalPayable),
                dueDateAd: dueDate,
                dueDateBs: period.dueDateBs,
                billNo: `FEE-${resolvedYear}${String(resolvedMonth).padStart(2, '0')}`,
            });
            if (resident.user?.email) {
                emailJobs.push({
                    name: queue_constants_1.JobType.SEND_INVOICE_EMAIL,
                    data: {
                        to: resident.user.email,
                        subject: bill.subject,
                        body: bill.body,
                        html: bill.html,
                    },
                });
            }
            if (resident.userId) {
                socketNotifications.push({
                    userId: resident.userId,
                    totalPayable,
                });
            }
        }
        let generatedCount = 0;
        let errors = 0;
        // 4. Chunked bulk insert inside a single database roundtrip
        try {
            const savedFees = await this.feeRepository.createFeesBulk(feesToCreate);
            generatedCount = savedFees.length;
        }
        catch (bulkErr) {
            console.error('❌ [FeeService] Error in bulk fee creation:', bulkErr.message);
            errors++;
            throw bulkErr;
        }
        // 5. Invalidate fee caches once in parallel across all tiers (NOT in the loop)
        await Promise.allSettled([
            cache_util_1.cacheService.invalidatePattern('resident:fees'),
            cache_util_1.cacheService.invalidatePattern('hostel:fees'),
            cache_util_1.cacheService.invalidatePattern('hostel:residents'),
            cache_util_1.cacheService.invalidatePattern('owner:dashboard'),
            cache_util_1.cacheService.invalidatePattern('owner:residents'),
        ]);
        // 6. Bulk dispatch email jobs in a single Redis transaction / direct SMTP
        let emailsDispatched = 0;
        if (emailJobs.length > 0) {
            try {
                await event_dispatcher_util_1.eventDispatcher.queueEmailsBulk(emailJobs, { timeoutMs: 10000 });
                emailsDispatched = emailJobs.length;
            }
            catch (err) {
                console.warn('⚠️ [FeeService] Bulk email dispatch warning:', err.message);
            }
        }
        // 7. Dispatch real-time push notifications
        for (const notif of socketNotifications) {
            try {
                socket_server_1.socketServer.toUser(notif.userId, queue_constants_1.SocketEvent.PAYMENT_PROCESSED, {
                    title: 'Monthly Fee Generated',
                    message: `Your ${period.nepaliMonthLabel} hostel fee of NPR ${baseFee} (Total due: NPR ${notif.totalPayable}) is due by ${dueDate}.`,
                    totalPayable: notif.totalPayable,
                });
            }
            catch {
                // Non-blocking
            }
        }
        console.log(`✅ [FeeService] Fee automation completed for ${period.nepaliMonthLabel}. Generated: ${generatedCount}, Errors: ${errors}, Emails: ${emailsDispatched}`);
        return { generatedCount, errors, nepaliMonth: period.nepaliMonthLabel, emailsDispatched };
    }
    async listHostelFees(hostelId, page = 1, limit = 20) {
        const cacheKey = cache_util_1.cacheService.generateKey('hostel:fees', { hostelId, page, limit });
        // 3-Level Cache: L1 (LRU RAM) -> L2 (Redis) -> L3 (DB)
        const { data, isCached, cacheLevel } = await cache_util_1.cacheService.wrap(cacheKey, async () => {
            const [fees, total] = await this.feeRepository.findByHostel(hostelId, page, limit);
            return { fees, total };
        }, { l1TtlSeconds: 30, l2TtlSeconds: 120 });
        return (0, pagination_util_1.createPaginatedResponse)(data.fees, data.total, { page, limit }, { isCached, cacheLevel });
    }
    async recordPayment(feeId, paidAmount, actorId) {
        if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
            return {
                error: { status: statusCode_interface_1.STATUS_CODE.BAD_REQUEST, message: 'paidAmount must be a positive number' },
            };
        }
        const fee = await this.feeRepository.findById(feeId);
        if (!fee) {
            return { error: { status: statusCode_interface_1.STATUS_CODE.NOT_FOUND, message: 'Fee not found' } };
        }
        // Same credit math as proof approval: clamped to the outstanding balance,
        // so a manual payment can never overpay or leave a stale PENDING status.
        const result = (0, fee_credit_util_1.applyPaymentToFeeAmounts)({
            totalPayable: Number(fee.totalPayable),
            paidAmount: Number(fee.paidAmount),
            status: fee.status,
        }, paidAmount);
        fee.paidAmount = result.paidAmount;
        fee.status = result.status;
        if (result.paidAmount >= result.totalPayable)
            fee.dueAmount = 0;
        const savedFee = await this.feeRepository.saveFee(fee);
        await this.invalidateFeeCaches();
        await event_dispatcher_util_1.eventDispatcher.dispatch({
            type: queue_constants_1.SocketEvent.PAYMENT_PROCESSED,
            payload: savedFee,
            userId: fee.resident.userId,
            hostelId: fee.hostelId,
            metadata: { actorId, feeId },
        });
        return { data: savedFee };
    }
    /**
     * PATCH /fees/:id/status — explicit owner/admin status override.
     *
     * Why this exists alongside PATCH /fees/:id/payment: clients already call
     * `/fees/:id/status` (booking/leave convention) e.g. to mark OVERDUE or to
     * correct a mislabelled row. Payment math still wins for the money fields:
     * a PAID status with an outstanding balance is repaired to fully-paid
     * (same settlement rule as proof approval), and a non-PAID status can
     * never claim `paidAmount >= totalPayable` — it is normalized to PAID.
     */
    async updateFeeStatus(feeId, status, actorId, paidAmount) {
        if (!Object.values(fee_enum_1.FeeStatus).includes(status)) {
            return {
                error: { status: statusCode_interface_1.STATUS_CODE.BAD_REQUEST, message: 'Invalid fee status' },
            };
        }
        if (paidAmount !== undefined && (!Number.isFinite(paidAmount) || paidAmount <= 0)) {
            return {
                error: { status: statusCode_interface_1.STATUS_CODE.BAD_REQUEST, message: 'paidAmount must be a positive number' },
            };
        }
        const fee = await this.feeRepository.findById(feeId);
        if (!fee) {
            return { error: { status: statusCode_interface_1.STATUS_CODE.NOT_FOUND, message: 'Fee not found' } };
        }
        // Apply any accompanying payment first (clamped to the outstanding balance).
        const result = (0, fee_credit_util_1.applyPaymentToFeeAmounts)({
            totalPayable: Number(fee.totalPayable),
            paidAmount: Number(fee.paidAmount),
            status: fee.status,
        }, paidAmount ?? 0);
        // paidAmount omitted / zero → applyPaymentToFeeAmounts settles the FULL
        // outstanding. For a pure status flip (e.g. PENDING → OVERDUE) that would
        // wrongly credit the bill, so keep the ledger untouched in that case.
        const keepLedger = paidAmount === undefined || !(paidAmount > 0);
        const nextPaidAmount = keepLedger ? Number(fee.paidAmount) : result.paidAmount;
        const total = Number(fee.totalPayable);
        const outstanding = Math.max(total - nextPaidAmount, 0);
        // Ledger truth wins: fully-paid money ⇒ PAID, outstanding ⇒ never PAID.
        // A PAID request on a bill with dues is treated as settlement (proof
        // approval behaves the same way); a non-PAID request on settled money
        // would lie on dashboards, so it normalizes back to PAID.
        let nextStatus = status;
        if (outstanding <= 0 && total > 0) {
            nextStatus = fee_enum_1.FeeStatus.PAID;
        }
        else if (outstanding > 0 && nextStatus === fee_enum_1.FeeStatus.PAID) {
            fee.paidAmount = total;
            fee.status = fee_enum_1.FeeStatus.PAID;
            fee.dueAmount = 0;
            const savedFee = await this.feeRepository.saveFee(fee);
            await this.invalidateFeeCaches();
            await event_dispatcher_util_1.eventDispatcher.dispatch({
                type: queue_constants_1.SocketEvent.PAYMENT_PROCESSED,
                payload: savedFee,
                userId: fee.resident.userId,
                hostelId: fee.hostelId,
                metadata: { actorId, feeId, status: nextStatus },
            });
            return { data: savedFee };
        }
        fee.paidAmount = nextPaidAmount;
        fee.status = nextStatus;
        if (nextStatus === fee_enum_1.FeeStatus.PAID)
            fee.dueAmount = 0;
        const savedFee = await this.feeRepository.saveFee(fee);
        await this.invalidateFeeCaches();
        await event_dispatcher_util_1.eventDispatcher.dispatch({
            type: queue_constants_1.SocketEvent.PAYMENT_PROCESSED,
            payload: savedFee,
            userId: fee.resident.userId,
            hostelId: fee.hostelId,
            metadata: { actorId, feeId, status: nextStatus },
        });
        return { data: savedFee };
    }
    async invalidateFeeCaches() {
        // Invalidate fee caches across all tiers (prefix — keys hold JSON params).
        await cache_util_1.cacheService.invalidatePattern(`resident:fees`);
        await cache_util_1.cacheService.invalidatePattern(`hostel:fees`);
        await cache_util_1.cacheService.invalidatePattern(`hostel:residents`);
        await cache_util_1.cacheService.invalidatePattern(`owner:dashboard`);
        await cache_util_1.cacheService.invalidatePattern(`owner:residents`);
    }
}
exports.FeeService = FeeService;
exports.feeService = new FeeService();
