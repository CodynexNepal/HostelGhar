"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExpenseFactory = void 0;
const expense_controller_1 = require("../../controller/expense/expense.controller");
const expense_repository_1 = require("../../repository/expense/expense.repository");
const expense_service_1 = require("../../services/expense/expense.service");
class ExpenseFactory {
    constructor() { }
    static create() {
        return new expense_controller_1.ExpenseController(new expense_service_1.ExpenseService(new expense_repository_1.ExpenseRepository()));
    }
}
exports.ExpenseFactory = ExpenseFactory;
