"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExpenseService = void 0;
const statusCode_interface_1 = require("../../constant/statusCode.interface");
const expense_enum_1 = require("../../enum/expense.enum");
const roles_enum_1 = require("../../enum/roles.enum");
const expense_repository_1 = require("../../repository/expense/expense.repository");
const createHttpError_1 = require("../../utils/createHttpError");
const cache_util_1 = require("../../utils/cache.util");
const pagination_util_1 = require("../../utils/pagination.util");
const database_source_1 = require("../../database/database-source");
const hostel_entity_1 = require("../../entities/hostel/hostel.entity");
class ExpenseService {
    constructor(expenseRepository = new expense_repository_1.ExpenseRepository()) {
        this.expenseRepository = expenseRepository;
    }
    isAdmin(role) {
        return role.toLowerCase() === roles_enum_1.IROLES.ADMIN.toLowerCase();
    }
    async authorizeHostel(actorId, role, hostelId) {
        const hostel = await database_source_1.AppDataSource.getRepository(hostel_entity_1.Hostel).findOne({ where: { id: hostelId } });
        if (!hostel)
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.NOT_FOUND, 'Hostel not found');
        if (!this.isAdmin(role) && hostel.ownerId !== actorId) {
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.FORBIDDEN, 'You do not manage this hostel');
        }
    }
    async ownedHostelIds(ownerId) {
        const rows = await database_source_1.AppDataSource.getRepository(hostel_entity_1.Hostel).find({
            where: { ownerId },
            select: { id: true },
        });
        return rows.map((hostel) => hostel.id);
    }
    async create(actorId, role, dto) {
        await this.authorizeHostel(actorId, role, dto.hostelId);
        const expense = this.expenseRepository.create({
            hostelId: dto.hostelId,
            title: dto.title.trim(),
            category: dto.category,
            amount: dto.amount,
            expenseDate: dto.expenseDate,
            notes: dto.notes?.trim() || null,
            status: dto.status ?? expense_enum_1.ExpenseStatus.PAID,
            createdById: actorId,
        });
        const saved = await this.expenseRepository.save(expense);
        await this.invalidateExpenseCaches(saved.id);
        await this.invalidateAnalytics();
        return saved;
    }
    async list(actorId, role, options) {
        const admin = this.isAdmin(role);
        // Single-hostel list: authorize first, then share one compressed cache entry
        // per hostel+filters+page (safe: every reader passed authorizeHostel).
        if (options.hostelId) {
            await this.authorizeHostel(actorId, role, options.hostelId);
            const cacheKey = cache_util_1.cacheService.generateKey('expenses:hostel', {
                hostelId: options.hostelId,
                category: options.category ?? 'ALL',
                status: options.status ?? 'ALL',
                page: options.page,
                limit: options.limit,
            });
            const { data, isCached, cacheLevel } = await cache_util_1.cacheService.wrap(cacheKey, async () => {
                const [expenses, total] = await this.expenseRepository.findPage({
                    hostelId: options.hostelId,
                    category: options.category,
                    status: options.status,
                }, options.page, options.limit);
                return { expenses, total };
            }, { l1TtlSeconds: 30, l2TtlSeconds: 120 });
            return (0, pagination_util_1.createPaginatedResponse)(data.expenses, data.total, options, { isCached, cacheLevel });
        }
        // All-hostels list: admins see everything; owners only their hostels.
        // Owner key is actor-scoped so one owner can never read another's cache.
        if (admin) {
            const cacheKey = cache_util_1.cacheService.generateKey('expenses:list', {
                scope: 'admin',
                category: options.category ?? 'ALL',
                status: options.status ?? 'ALL',
                page: options.page,
                limit: options.limit,
            });
            const { data, isCached, cacheLevel } = await cache_util_1.cacheService.wrap(cacheKey, async () => {
                const [expenses, total] = await this.expenseRepository.findPage({ category: options.category, status: options.status }, options.page, options.limit);
                return { expenses, total };
            }, { l1TtlSeconds: 30, l2TtlSeconds: 120 });
            return (0, pagination_util_1.createPaginatedResponse)(data.expenses, data.total, options, {
                isCached,
                cacheLevel,
            });
        }
        const cacheKey = cache_util_1.cacheService.generateKey('expenses:list', {
            scope: 'owner',
            actorId,
            category: options.category ?? 'ALL',
            status: options.status ?? 'ALL',
            page: options.page,
            limit: options.limit,
        });
        const { data, isCached, cacheLevel } = await cache_util_1.cacheService.wrap(cacheKey, async () => {
            const hostelIds = await this.ownedHostelIds(actorId);
            if (!hostelIds.length)
                return { expenses: [], total: 0 };
            const [expenses, total] = await this.expenseRepository.findPage({ hostelIds, category: options.category, status: options.status }, options.page, options.limit);
            return { expenses, total };
        }, { l1TtlSeconds: 30, l2TtlSeconds: 120 });
        return (0, pagination_util_1.createPaginatedResponse)(data.expenses, data.total, options, {
            isCached,
            cacheLevel,
        });
    }
    async getById(actorId, role, id) {
        const cacheKey = cache_util_1.cacheService.generateKey('expenses:detail', { id });
        const { data: expense } = await cache_util_1.cacheService.wrap(cacheKey, async () => this.expenseRepository.findById(id), { l1TtlSeconds: 60, l2TtlSeconds: 300 });
        if (!expense)
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.NOT_FOUND, 'Expense not found');
        await this.authorizeHostel(actorId, role, expense.hostelId);
        return expense;
    }
    async update(actorId, role, id, dto) {
        const expense = await this.getById(actorId, role, id);
        if (dto.title !== undefined)
            expense.title = dto.title.trim();
        if (dto.category !== undefined)
            expense.category = dto.category;
        if (dto.amount !== undefined)
            expense.amount = dto.amount;
        if (dto.expenseDate !== undefined)
            expense.expenseDate = dto.expenseDate;
        if (dto.notes !== undefined)
            expense.notes = dto.notes?.trim() || null;
        if (dto.status !== undefined)
            expense.status = dto.status;
        const saved = await this.expenseRepository.save(expense);
        await this.invalidateExpenseCaches(saved.id);
        await this.invalidateAnalytics();
        return saved;
    }
    async remove(actorId, role, id) {
        const expense = await this.getById(actorId, role, id);
        await this.expenseRepository.remove(expense);
        await this.invalidateExpenseCaches(id);
        await this.invalidateAnalytics();
    }
    async invalidateExpenseCaches(expenseId) {
        const tasks = [
            cache_util_1.cacheService.invalidatePattern('expenses:list'),
            cache_util_1.cacheService.invalidatePattern('expenses:hostel'),
        ];
        if (expenseId) {
            tasks.push(cache_util_1.cacheService.invalidate(cache_util_1.cacheService.generateKey('expenses:detail', { id: expenseId })));
        }
        await Promise.all(tasks);
    }
    async invalidateAnalytics() {
        await Promise.all([
            cache_util_1.cacheService.invalidatePattern('analytics:owner'),
            cache_util_1.cacheService.invalidatePattern('analytics:admin'),
        ]);
    }
}
exports.ExpenseService = ExpenseService;
