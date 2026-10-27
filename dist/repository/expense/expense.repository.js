"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExpenseRepository = void 0;
const database_source_1 = require("../../database/database-source");
const expense_entity_1 = require("../../entities/expense/expense.entity");
class ExpenseRepository {
    constructor() {
        this.expenseRepo = database_source_1.AppDataSource.getRepository(expense_entity_1.Expense);
    }
    create(data) {
        return this.expenseRepo.create(data);
    }
    save(expense) {
        return this.expenseRepo.save(expense);
    }
    findById(id) {
        return this.expenseRepo.findOne({ where: { id }, relations: { hostel: true } });
    }
    findPage(filters, page, limit) {
        const query = this.applyFilters(this.expenseRepo.createQueryBuilder('expense'), filters);
        return query
            .leftJoinAndSelect('expense.hostel', 'hostel')
            .orderBy('expense.expenseDate', 'DESC')
            .addOrderBy('expense.createdAt', 'DESC')
            .skip((page - 1) * limit)
            .take(limit)
            .getManyAndCount();
    }
    remove(expense) {
        return this.expenseRepo.remove(expense);
    }
    applyFilters(query, { hostelId, hostelIds, category, status }) {
        if (hostelId)
            query.andWhere('expense.hostelId = :hostelId', { hostelId });
        else if (hostelIds)
            query.andWhere('expense.hostelId IN (:...hostelIds)', { hostelIds });
        if (category)
            query.andWhere('expense.category = :category', { category });
        if (status)
            query.andWhere('expense.status = :status', { status });
        return query;
    }
}
exports.ExpenseRepository = ExpenseRepository;
