"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExpenseController = void 0;
const statusCode_interface_1 = require("../../constant/statusCode.interface");
const expense_enum_1 = require("../../enum/expense.enum");
const http_decorator_1 = require("../../decorators/http.decorator");
const pagination_util_1 = require("../../utils/pagination.util");
const createHttpError_1 = require("../../utils/createHttpError");
class ExpenseController {
    constructor(expenseService) {
        this.expenseService = expenseService;
        this.create = async (req, res, next) => {
            try {
                const data = await this.expenseService.create(req.user.userId, req.user.role, req.body);
                res.status(statusCode_interface_1.STATUS_CODE.CREATED).json({ success: true, message: 'Expense created', data });
            }
            catch (error) {
                next(error);
            }
        };
        this.list = async (req, res, next) => {
            try {
                const { page, limit } = (0, pagination_util_1.normalizePagination)({
                    page: req.query.page,
                    limit: req.query.limit,
                });
                const category = this.enumQuery(req.query.category, expense_enum_1.ExpenseCategory, 'category');
                const status = this.enumQuery(req.query.status, expense_enum_1.ExpenseStatus, 'status');
                const result = await this.expenseService.list(req.user.userId, req.user.role, {
                    page,
                    limit,
                    category,
                    status,
                    hostelId: typeof req.query.hostelId === 'string' ? req.query.hostelId : undefined,
                });
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({ success: true, ...result });
            }
            catch (error) {
                next(error);
            }
        };
        this.getById = async (req, res, next) => {
            try {
                const data = await this.expenseService.getById(req.user.userId, req.user.role, (0, http_decorator_1.getRequiredParam)(req, 'id'));
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({ success: true, data });
            }
            catch (error) {
                next(error);
            }
        };
        this.update = async (req, res, next) => {
            try {
                const data = await this.expenseService.update(req.user.userId, req.user.role, (0, http_decorator_1.getRequiredParam)(req, 'id'), req.body);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({ success: true, message: 'Expense updated', data });
            }
            catch (error) {
                next(error);
            }
        };
        this.remove = async (req, res, next) => {
            try {
                await this.expenseService.remove(req.user.userId, req.user.role, (0, http_decorator_1.getRequiredParam)(req, 'id'));
                res.status(statusCode_interface_1.STATUS_CODE.DELETED).json({ success: true, message: 'Expense deleted' });
            }
            catch (error) {
                next(error);
            }
        };
    }
    enumQuery(value, values, name) {
        if (typeof value !== 'string')
            return undefined;
        const normalized = value.toUpperCase();
        if (!(normalized in values)) {
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.BAD_REQUEST, `${name} is invalid`);
        }
        return normalized;
    }
}
exports.ExpenseController = ExpenseController;
