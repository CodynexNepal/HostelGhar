"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: payment.service.ts
// PURPOSE: Centralized business logic for partial payments, overdue management,
//          atomic payment transactions, idempotency, and financial auditing.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentService = exports.PaymentService = void 0;
const database_source_1 = require("../../database/database-source");
const fee_entity_1 = require("../../entities/fee/fee.entity");
const payment_entity_1 = require("../../entities/payment/payment.entity");
const resident_entity_1 = require("../../entities/resident/resident.entity");
const hostel_entity_1 = require("../../entities/hostel/hostel.entity");
const fee_enum_1 = require("../../enum/fee.enum");
const payment_enum_1 = require("../../enum/payment.enum");
const roles_enum_1 = require("../../enum/roles.enum");
const statusCode_interface_1 = require("../../constant/statusCode.interface");
const createHttpError_1 = require("../../utils/createHttpError");
const fee_credit_util_1 = require("../../utils/fee-credit.util");
const cache_util_1 = require("../../utils/cache.util");
const event_dispatcher_util_1 = require("../../utils/event-dispatcher.util");
const queue_constants_1 = require("../../constant/queue.constants");
const notification_service_1 = require("../notification/notification.service");
const payment_repository_1 = require("../../repository/payment/payment.repository");
const pagination_util_1 = require("../../utils/pagination.util");
class PaymentService {
    constructor(paymentRepo = new payment_repository_1.PaymentRepository()) {
        this.paymentRepo = paymentRepo;
    }
    /**
     * Validates actor authorization for a hostel or fee resource.
     */
    async authorizeHostel(actorId, role, hostelId) {
        const normalizedRole = role.toLowerCase();
        const hostelRepo = database_source_1.AppDataSource.getRepository(hostel_entity_1.Hostel);
        const hostel = await hostelRepo.findOne({
            where: { id: hostelId },
            relations: { owner: true },
        });
        if (!hostel) {
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.NOT_FOUND, 'Hostel not found');
        }
        if (normalizedRole === roles_enum_1.IROLES.ADMIN.toLowerCase()) {
            return hostel;
        }
        if (normalizedRole === roles_enum_1.IROLES.OWNER.toLowerCase() && hostel.ownerId === actorId) {
            return hostel;
        }
        throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.FORBIDDEN, 'You are not authorized to perform payment operations for this hostel');
    }
    /**
     * Atomically records a payment against an invoice (fee) with idempotency,
     * pessimistic row locking, and status/outstanding calculations.
     */
    async recordPayment(actorId, role, feeId, dto) {
        const paymentAmount = (0, fee_credit_util_1.roundMoney)(dto.amount);
        if (paymentAmount <= 0) {
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.BAD_REQUEST, 'Payment amount must be greater than zero');
        }
        // Execute within a serializable/pessimistic-lock database transaction
        const result = await database_source_1.AppDataSource.transaction(async (manager) => {
            // 1. Fetch fee with write lock to prevent race conditions & overpayments
            const fee = await manager.findOne(fee_entity_1.Fee, {
                where: { id: feeId },
                lock: { mode: 'pessimistic_write' },
                relations: {
                    resident: { user: true },
                    hostel: { owner: true },
                },
            });
            if (!fee) {
                throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.NOT_FOUND, 'Invoice / Fee bill not found');
            }
            // 2. Authorization check
            const normalizedRole = role.toLowerCase();
            if (normalizedRole === roles_enum_1.IROLES.RESIDENT.toLowerCase()) {
                const residentRepo = manager.getRepository(resident_entity_1.Resident);
                const resident = await residentRepo.findOne({
                    where: { userId: actorId, isActive: true },
                });
                if (!resident || resident.id !== fee.residentId) {
                    throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.FORBIDDEN, 'You can only pay your own invoices');
                }
            }
            else if (normalizedRole === roles_enum_1.IROLES.OWNER.toLowerCase()) {
                if (fee.hostel.ownerId !== actorId) {
                    throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.FORBIDDEN, 'You are not authorized to record payments for this hostel');
                }
            }
            else if (normalizedRole !== roles_enum_1.IROLES.ADMIN.toLowerCase()) {
                throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.FORBIDDEN, 'Unauthorized payment actor role');
            }
            // 3. Status checks
            if (fee.status === fee_enum_1.FeeStatus.CANCELLED) {
                throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.BAD_REQUEST, 'Cannot record payment for a cancelled invoice');
            }
            // 4. Idempotency checks
            if (dto.idempotencyKey?.trim()) {
                const existingKey = await manager.findOne(payment_entity_1.Payment, {
                    where: { idempotencyKey: dto.idempotencyKey.trim() },
                });
                if (existingKey) {
                    return { payment: existingKey, fee, isDuplicate: true };
                }
            }
            if (dto.transactionReference?.trim()) {
                const existingRef = await manager.findOne(payment_entity_1.Payment, {
                    where: { invoiceId: fee.id, transactionReference: dto.transactionReference.trim() },
                });
                if (existingRef) {
                    return { payment: existingRef, fee, isDuplicate: true };
                }
            }
            // 5. Calculate outstanding
            const outstanding = (0, fee_credit_util_1.feeOutstandingAmount)(fee);
            if (outstanding <= 0 && fee.status === fee_enum_1.FeeStatus.PAID) {
                throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.BAD_REQUEST, 'This invoice is already fully paid');
            }
            if (paymentAmount > outstanding) {
                throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.BAD_REQUEST, `Payment amount of NPR ${paymentAmount} exceeds remaining balance of NPR ${outstanding}`);
            }
            // 6. Generate receipt number
            const receiptNumber = `REC-${fee.billingYear}${String(fee.billingMonth).padStart(2, '0')}-${Math.floor(100000 + Math.random() * 900000)}`;
            // 7. Insert payment
            const payment = manager.create(payment_entity_1.Payment, {
                invoiceId: fee.id,
                residentId: fee.residentId,
                hostelId: fee.hostelId,
                amount: paymentAmount,
                paymentMethod: dto.paymentMethod ?? payment_enum_1.PaymentMethod.CASH,
                paymentStatus: payment_enum_1.PaymentStatus.SUCCESS,
                transactionReference: dto.transactionReference?.trim() || null,
                idempotencyKey: dto.idempotencyKey?.trim() || null,
                receiptNumber,
                receivedBy: actorId,
                paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
                remarks: dto.remarks?.trim() || null,
            });
            const savedPayment = await manager.save(payment);
            // 8. Update fee balance & status using centralized calculation
            const creditResult = (0, fee_credit_util_1.applyPaymentToFeeAmounts)({
                totalPayable: Number(fee.totalPayable),
                paidAmount: Number(fee.paidAmount),
                discountAmount: Number(fee.discountAmount ?? 0),
                dueDate: fee.dueDate,
                status: fee.status,
            }, paymentAmount);
            fee.paidAmount = creditResult.paidAmount;
            fee.outstandingAmount = creditResult.outstandingAmount;
            fee.status = creditResult.status;
            if (creditResult.outstandingAmount === 0) {
                fee.dueAmount = 0;
            }
            const savedFee = await manager.save(fee);
            return { payment: savedPayment, fee: savedFee, isDuplicate: false };
        });
        // Post-transaction notifications and cache invalidations
        if (!result.isDuplicate) {
            await this.invalidatePaymentCaches(result.fee.hostelId, result.fee.residentId);
            // Push real-time event
            await event_dispatcher_util_1.eventDispatcher.dispatch({
                type: queue_constants_1.SocketEvent.PAYMENT_PROCESSED,
                payload: { payment: result.payment, fee: result.fee },
                userId: result.fee.resident?.userId,
                hostelId: result.fee.hostelId,
                metadata: { actorId, feeId, paymentId: result.payment.id },
            });
            // Resident notification
            if (result.fee.resident?.userId) {
                const isFull = result.fee.status === fee_enum_1.FeeStatus.PAID;
                const notifTitle = isFull ? 'Invoice Fully Paid! 🎉' : 'Partial Payment Received';
                const notifMessage = isFull
                    ? `Your invoice for Month ${result.fee.billingMonth}/${result.fee.billingYear} has been fully settled (Paid: NPR ${paymentAmount}).`
                    : `Payment of NPR ${paymentAmount} recorded. Remaining balance: NPR ${result.fee.outstandingAmount}.`;
                await notification_service_1.notificationService.createNotification({
                    userId: result.fee.resident.userId,
                    hostelId: result.fee.hostelId,
                    type: 'PAYMENT_CONFIRMED',
                    entityType: 'payment',
                    entityId: result.payment.id,
                    title: notifTitle,
                    message: notifMessage,
                    targetUrl: '/resident/payments',
                    metadata: {
                        feeId,
                        paymentId: result.payment.id,
                        amount: paymentAmount,
                        remainingBalance: result.fee.outstandingAmount,
                    },
                });
            }
        }
        return result;
    }
    /**
     * Retrieves an invoice and all its payment transactions.
     */
    async getInvoiceDetails(actorId, role, feeId) {
        const feeRepo = database_source_1.AppDataSource.getRepository(fee_entity_1.Fee);
        const fee = await feeRepo.findOne({
            where: { id: feeId },
            relations: {
                resident: { user: true },
                hostel: { owner: true },
                payments: { receivedByUser: true },
            },
        });
        if (!fee) {
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.NOT_FOUND, 'Invoice not found');
        }
        const normalizedRole = role.toLowerCase();
        if (normalizedRole === roles_enum_1.IROLES.RESIDENT.toLowerCase()) {
            if (fee.resident?.userId !== actorId) {
                throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.FORBIDDEN, 'Access denied to this invoice');
            }
        }
        else if (normalizedRole === roles_enum_1.IROLES.OWNER.toLowerCase()) {
            if (fee.hostel?.ownerId !== actorId) {
                throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.FORBIDDEN, 'Access denied to this hostel invoice');
            }
        }
        fee.outstandingAmount = (0, fee_credit_util_1.feeOutstandingAmount)(fee);
        fee.status = (0, fee_credit_util_1.calculatePaymentStatus)(fee);
        return fee;
    }
    /**
     * Retrieves payments list for a hostel (for hostel owners/admins).
     */
    async getHostelPayments(actorId, role, hostelId, page = 1, limit = 20, filters = {}) {
        await this.authorizeHostel(actorId, role, hostelId);
        const [payments, total] = await this.paymentRepo.findByHostel(hostelId, page, limit, filters);
        return (0, pagination_util_1.createPaginatedResponse)(payments, total, { page, limit });
    }
    /**
     * Retrieves payments made by the logged-in resident.
     */
    async getResidentPayments(userId, page = 1, limit = 20) {
        const residentRepo = database_source_1.AppDataSource.getRepository(resident_entity_1.Resident);
        const resident = await residentRepo.findOne({
            where: { userId, isActive: true },
        });
        if (!resident) {
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.NOT_FOUND, 'Resident profile not found');
        }
        const [payments, total] = await this.paymentRepo.findByResident(resident.id, page, limit);
        return (0, pagination_util_1.createPaginatedResponse)(payments, total, { page, limit });
    }
    /**
     * Generates formatted receipt data for download/printing.
     */
    async getReceipt(actorId, role, paymentId) {
        const payment = await this.paymentRepo.findById(paymentId);
        if (!payment) {
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.NOT_FOUND, 'Payment record not found');
        }
        const normalizedRole = role.toLowerCase();
        if (normalizedRole === roles_enum_1.IROLES.RESIDENT.toLowerCase()) {
            if (payment.resident?.userId !== actorId) {
                throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.FORBIDDEN, 'Access denied to this receipt');
            }
        }
        else if (normalizedRole === roles_enum_1.IROLES.OWNER.toLowerCase()) {
            if (payment.hostel?.ownerId !== actorId) {
                throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.FORBIDDEN, 'Access denied to this receipt');
            }
        }
        return {
            receiptNumber: payment.receiptNumber,
            paymentId: payment.id,
            paidAt: payment.paidAt,
            amount: Number(payment.amount),
            paymentMethod: payment.paymentMethod,
            transactionReference: payment.transactionReference,
            remarks: payment.remarks,
            student: {
                name: `${payment.resident?.user?.firstName ?? ''} ${payment.resident?.user?.lastName ?? ''}`.trim(),
                email: payment.resident?.user?.email,
                phone: payment.resident?.user?.phone,
                roomNumber: payment.resident?.roomNumber,
                bedNumber: payment.resident?.bedNumber,
            },
            hostel: {
                name: payment.hostel?.name,
                address: payment.hostel?.address,
                city: payment.hostel?.city,
                phone: payment.hostel?.phone,
            },
            invoice: {
                invoiceNumber: payment.fee?.invoiceNumber,
                billingMonth: payment.fee?.billingMonth,
                billingYear: payment.fee?.billingYear,
                totalPayable: Number(payment.fee?.totalPayable),
                paidAmount: Number(payment.fee?.paidAmount),
                outstandingAmount: Number(payment.fee?.outstandingAmount),
                status: payment.fee?.status,
            },
            receiver: payment.receivedByUser
                ? `${payment.receivedByUser.firstName} ${payment.receivedByUser.lastName}`.trim()
                : 'System',
        };
    }
    /**
     * Syncs overdue status for all pending/partial fees past due date.
     */
    async syncOverdueFees(hostelId) {
        const feeRepo = database_source_1.AppDataSource.getRepository(fee_entity_1.Fee);
        const qb = feeRepo
            .createQueryBuilder('f')
            .where('f.status IN (:...statuses)', {
            statuses: [fee_enum_1.FeeStatus.PENDING, fee_enum_1.FeeStatus.PARTIALLY_PAID],
        })
            .andWhere('f.dueDate < CURRENT_DATE')
            .andWhere('GREATEST(0, f.totalPayable - f.discountAmount - f.paidAmount) > 0');
        if (hostelId) {
            qb.andWhere('f.hostelId = :hostelId', { hostelId });
        }
        const overdueFees = await qb.getMany();
        if (overdueFees.length === 0)
            return 0;
        for (const fee of overdueFees) {
            fee.status = fee_enum_1.FeeStatus.OVERDUE;
            fee.outstandingAmount = (0, fee_credit_util_1.feeOutstandingAmount)(fee);
        }
        await feeRepo.save(overdueFees);
        await cache_util_1.cacheService.invalidatePattern('hostel:fees');
        await cache_util_1.cacheService.invalidatePattern('resident:fees');
        return overdueFees.length;
    }
    async invalidatePaymentCaches(hostelId, residentId) {
        await cache_util_1.cacheService.invalidatePattern(`resident:fees:${residentId}`);
        await cache_util_1.cacheService.invalidatePattern(`resident:fees`);
        await cache_util_1.cacheService.invalidatePattern(`hostel:fees:${hostelId}`);
        await cache_util_1.cacheService.invalidatePattern(`hostel:fees`);
        await cache_util_1.cacheService.invalidatePattern(`owner:dashboard`);
        await cache_util_1.cacheService.invalidatePattern(`analytics`);
    }
}
exports.PaymentService = PaymentService;
exports.paymentService = new PaymentService();
