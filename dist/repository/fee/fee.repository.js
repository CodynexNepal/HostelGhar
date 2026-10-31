"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeeRepository = exports.generateInvoiceNumber = void 0;
const typeorm_1 = require("typeorm");
const database_source_1 = require("../../database/database-source");
const fee_entity_1 = require("../../entities/fee/fee.entity");
const resident_entity_1 = require("../../entities/resident/resident.entity");
const fee_enum_1 = require("../../enum/fee.enum");
const fee_credit_util_1 = require("../../utils/fee-credit.util");
const generateInvoiceNumber = (month, year) => {
    const rand = Math.floor(100000 + Math.random() * 900000);
    return `INV-${year}${String(month).padStart(2, '0')}-${rand}`;
};
exports.generateInvoiceNumber = generateInvoiceNumber;
class FeeRepository {
    constructor() {
        this.feeRepo = database_source_1.AppDataSource.getRepository(fee_entity_1.Fee);
        this.residentRepo = database_source_1.AppDataSource.getRepository(resident_entity_1.Resident);
    }
    async findActiveResidents(hostelId) {
        const where = { isActive: true };
        if (hostelId) {
            where.hostelId = hostelId;
        }
        return this.residentRepo.find({
            where,
            relations: { user: true, hostel: { owner: true } },
        });
    }
    async findPendingFeesByResident(residentId) {
        const fees = await this.feeRepo.find({
            where: {
                residentId,
                status: (0, typeorm_1.In)([fee_enum_1.FeeStatus.PENDING, fee_enum_1.FeeStatus.PARTIALLY_PAID, fee_enum_1.FeeStatus.OVERDUE]),
            },
        });
        return fees.map((fee) => {
            fee.outstandingAmount = (0, fee_credit_util_1.feeOutstandingAmount)(fee);
            fee.status = (0, fee_credit_util_1.calculatePaymentStatus)(fee);
            return fee;
        });
    }
    async findMonthlyFee(residentId, billingMonth, billingYear) {
        const fee = await this.feeRepo.findOne({
            where: { residentId, billingMonth, billingYear, feeType: fee_enum_1.FeeType.MONTHLY_HOSTEL_FEE },
            relations: { payments: true },
        });
        if (fee) {
            fee.outstandingAmount = (0, fee_credit_util_1.feeOutstandingAmount)(fee);
            fee.status = (0, fee_credit_util_1.calculatePaymentStatus)(fee);
        }
        return fee;
    }
    /**
     * Batch lookup of existing monthly fees for a list of residents in one query.
     * Eliminates N individual queries during monthly fee automation.
     */
    async findExistingMonthlyFees(residentIds, billingMonth, billingYear) {
        if (residentIds.length === 0)
            return [];
        return this.feeRepo.find({
            where: {
                residentId: (0, typeorm_1.In)(residentIds),
                billingMonth,
                billingYear,
                feeType: fee_enum_1.FeeType.MONTHLY_HOSTEL_FEE,
            },
            select: [
                'id',
                'residentId',
                'billingMonth',
                'billingYear',
                'totalPayable',
                'amount',
                'discountAmount',
                'outstandingAmount',
                'paidAmount',
                'dueAmount',
                'dueDate',
                'invoiceNumber',
                'status',
            ],
        });
    }
    /**
     * Batch aggregate query to calculate outstanding pending/unpaid balances for all residents in ONE query.
     * Eliminates N individual pending fee queries during monthly fee generation.
     */
    async findPendingBalancesByResidents(residentIds) {
        const balances = new Map();
        if (residentIds.length === 0)
            return balances;
        const rawTotals = await this.feeRepo
            .createQueryBuilder('fee')
            .select('fee.residentId', 'residentId')
            .addSelect('SUM(GREATEST(0, fee.totalPayable - fee.discountAmount - fee.paidAmount))', 'outstandingDue')
            .where('fee.residentId IN (:...residentIds)', { residentIds })
            .andWhere('fee.status IN (:...statuses)', {
            statuses: [fee_enum_1.FeeStatus.PENDING, fee_enum_1.FeeStatus.PARTIALLY_PAID, fee_enum_1.FeeStatus.OVERDUE],
        })
            .groupBy('fee.residentId')
            .getRawMany();
        for (const row of rawTotals) {
            balances.set(row.residentId, Math.max(0, Number(row.outstandingDue) || 0));
        }
        return balances;
    }
    /**
     * Bulk persists fee records in a single transactional chunk.
     */
    async createFeesBulk(feesData) {
        if (feesData.length === 0)
            return [];
        const withInvoices = feesData.map((f) => {
            const month = f.billingMonth ?? 1;
            const year = f.billingYear ?? new Date().getFullYear();
            const invoiceNumber = f.invoiceNumber || (0, exports.generateInvoiceNumber)(month, year);
            const totalPayable = (0, fee_credit_util_1.roundMoney)(f.totalPayable ?? 10500);
            const discountAmount = (0, fee_credit_util_1.roundMoney)(f.discountAmount ?? 0);
            const paidAmount = (0, fee_credit_util_1.roundMoney)(f.paidAmount ?? 0);
            const outstandingAmount = (0, fee_credit_util_1.roundMoney)(Math.max(0, totalPayable - discountAmount - paidAmount));
            return {
                ...f,
                invoiceNumber,
                totalPayable,
                discountAmount,
                paidAmount,
                outstandingAmount,
            };
        });
        const entities = this.feeRepo.create(withInvoices);
        return this.feeRepo.save(entities, { chunk: 100 });
    }
    async createFee(data) {
        const month = data.billingMonth ?? 1;
        const year = data.billingYear ?? new Date().getFullYear();
        const invoiceNumber = data.invoiceNumber || (0, exports.generateInvoiceNumber)(month, year);
        const totalPayable = (0, fee_credit_util_1.roundMoney)(data.totalPayable ?? 10500);
        const discountAmount = (0, fee_credit_util_1.roundMoney)(data.discountAmount ?? 0);
        const paidAmount = (0, fee_credit_util_1.roundMoney)(data.paidAmount ?? 0);
        const outstandingAmount = (0, fee_credit_util_1.roundMoney)(Math.max(0, totalPayable - discountAmount - paidAmount));
        const fee = this.feeRepo.create({
            ...data,
            invoiceNumber,
            totalPayable,
            discountAmount,
            paidAmount,
            outstandingAmount,
        });
        return this.feeRepo.save(fee);
    }
    async saveFee(fee) {
        return this.feeRepo.save(fee);
    }
    async findById(id) {
        const fee = await this.feeRepo.findOne({
            where: { id },
            relations: {
                resident: { user: true },
                hostel: { owner: true },
                payments: { receivedByUser: true },
            },
        });
        if (fee) {
            fee.outstandingAmount = (0, fee_credit_util_1.feeOutstandingAmount)(fee);
            fee.status = (0, fee_credit_util_1.calculatePaymentStatus)(fee);
        }
        return fee;
    }
    async findByHostel(hostelId, page = 1, limit = 20, filters = {}) {
        const qb = this.feeRepo
            .createQueryBuilder('f')
            .leftJoinAndSelect('f.resident', 'resident')
            .leftJoinAndSelect('resident.user', 'user')
            .leftJoinAndSelect('f.payments', 'payments')
            .where('f.hostelId = :hostelId', { hostelId });
        if (filters.billingMonth) {
            qb.andWhere('f.billingMonth = :month', { month: filters.billingMonth });
        }
        if (filters.billingYear) {
            qb.andWhere('f.billingYear = :year', { year: filters.billingYear });
        }
        if (filters.status) {
            const normalizedStatus = filters.status.toUpperCase().trim();
            if (normalizedStatus === 'PARTIAL') {
                qb.andWhere('f.status = :status', { status: fee_enum_1.FeeStatus.PARTIALLY_PAID });
            }
            else if (normalizedStatus === fee_enum_1.FeeStatus.OVERDUE) {
                // Outstanding > 0 and (status is OVERDUE OR dueDate < today)
                qb.andWhere('GREATEST(0, f.totalPayable - f.discountAmount - f.paidAmount) > 0').andWhere('(f.status = :overdueStatus OR f.dueDate < CURRENT_DATE)', {
                    overdueStatus: fee_enum_1.FeeStatus.OVERDUE,
                });
            }
            else if (Object.values(fee_enum_1.FeeStatus).includes(normalizedStatus)) {
                qb.andWhere('f.status = :status', { status: normalizedStatus });
            }
        }
        if (filters.search?.trim()) {
            const term = `%${filters.search.trim().toLowerCase()}%`;
            qb.andWhere('(LOWER(user.firstName) LIKE :term OR LOWER(user.lastName) LIKE :term OR LOWER(resident.roomNumber) LIKE :term OR LOWER(f.invoiceNumber) LIKE :term)', { term });
        }
        qb.orderBy('f.billingYear', 'DESC')
            .addOrderBy('f.billingMonth', 'DESC')
            .addOrderBy('f.createdAt', 'DESC')
            .skip((page - 1) * limit)
            .take(limit);
        const [fees, total] = await qb.getManyAndCount();
        const normalizedFees = fees.map((f) => {
            f.outstandingAmount = (0, fee_credit_util_1.feeOutstandingAmount)(f);
            f.status = (0, fee_credit_util_1.calculatePaymentStatus)(f);
            return f;
        });
        return [normalizedFees, total];
    }
}
exports.FeeRepository = FeeRepository;
