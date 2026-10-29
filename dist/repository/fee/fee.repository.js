"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeeRepository = void 0;
const typeorm_1 = require("typeorm");
const database_source_1 = require("../../database/database-source");
const fee_entity_1 = require("../../entities/fee/fee.entity");
const resident_entity_1 = require("../../entities/resident/resident.entity");
const fee_enum_1 = require("../../enum/fee.enum");
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
        // Outstanding = anything not fully PAID (PENDING + PARTIALLY_PAID + OVERDUE).
        // Only querying PENDING drops partial remainders from next month's dueAmount.
        return this.feeRepo.find({
            where: {
                residentId,
                status: (0, typeorm_1.In)([fee_enum_1.FeeStatus.PENDING, fee_enum_1.FeeStatus.PARTIALLY_PAID, fee_enum_1.FeeStatus.OVERDUE]),
            },
        });
    }
    async findMonthlyFee(residentId, billingMonth, billingYear) {
        return this.feeRepo.findOne({
            where: { residentId, billingMonth, billingYear, feeType: fee_enum_1.FeeType.MONTHLY_HOSTEL_FEE },
        });
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
            select: ['id', 'residentId', 'billingMonth', 'billingYear', 'totalPayable'],
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
            .addSelect('SUM(fee.totalPayable - fee.paidAmount)', 'outstandingDue')
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
        const entities = this.feeRepo.create(feesData);
        return this.feeRepo.save(entities, { chunk: 100 });
    }
    async createFee(data) {
        const fee = this.feeRepo.create(data);
        return this.feeRepo.save(fee);
    }
    async saveFee(fee) {
        return this.feeRepo.save(fee);
    }
    async findById(id) {
        return this.feeRepo.findOne({
            where: { id },
            relations: { resident: { user: true }, hostel: true },
        });
    }
    async findByHostel(hostelId, page = 1, limit = 20) {
        return this.feeRepo.findAndCount({
            where: { hostelId },
            relations: { resident: { user: true } },
            order: { billingYear: 'DESC', billingMonth: 'DESC' },
            skip: (page - 1) * limit,
            take: limit,
        });
    }
}
exports.FeeRepository = FeeRepository;
