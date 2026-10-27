"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StaffController = void 0;
const statusCode_interface_1 = require("../../constant/statusCode.interface");
const staff_enum_1 = require("../../enum/staff.enum");
const http_decorator_1 = require("../../decorators/http.decorator");
const pagination_util_1 = require("../../utils/pagination.util");
const createHttpError_1 = require("../../utils/createHttpError");
const upload_middleware_1 = require("../../middleware/upload.middleware");
class StaffController {
    constructor(staffService) {
        this.staffService = staffService;
        /**
         * POST /staff — Owner/Admin creates a staff member for a hostel.
         * Accepts JSON or multipart/form-data (photo under `photo` field, ≤5MB).
         * hostelId may come from body, ?hostelId= or X-Hostel-Id header.
         */
        this.create = async (req, res, next) => {
            try {
                const body = req.body;
                if (!body.hostelId) {
                    const fromQuery = typeof req.query.hostelId === 'string' ? req.query.hostelId : undefined;
                    const fromHeader = typeof req.headers['x-hostel-id'] === 'string' ? req.headers['x-hostel-id'] : undefined;
                    const resolved = fromQuery ?? fromHeader;
                    if (resolved)
                        req.body.hostelId = resolved;
                }
                const file = (0, upload_middleware_1.pickStaffPhotoFile)(req);
                const data = await this.staffService.create(req.user.userId, req.user.role, req.body, file);
                res
                    .status(statusCode_interface_1.STATUS_CODE.CREATED)
                    .json({ success: true, message: 'Staff member created', data });
            }
            catch (error) {
                next(error);
            }
        };
        /**
         * GET /staff?hostelId= — hostel-scoped list for owner dashboard.
         * Omitting hostelId returns the owner's staff across all their hostels.
         */
        this.list = async (req, res, next) => {
            try {
                const { page, limit } = (0, pagination_util_1.normalizePagination)({
                    page: req.query.page,
                    limit: req.query.limit,
                });
                const headerHostel = typeof req.headers['x-hostel-id'] === 'string' ? req.headers['x-hostel-id'] : undefined;
                const queryHostel = typeof req.query.hostelId === 'string' ? req.query.hostelId : undefined;
                const result = await this.staffService.list(req.user.userId, req.user.role, {
                    page,
                    limit,
                    hostelId: queryHostel ?? headerHostel,
                    role: this.enumQuery(req.query.role, staff_enum_1.StaffRole, 'role'),
                    shift: this.enumQuery(req.query.shift, staff_enum_1.StaffShift, 'shift'),
                    status: this.enumQuery(req.query.status, staff_enum_1.StaffStatus, 'status'),
                    search: typeof req.query.search === 'string' ? req.query.search.trim() || undefined : undefined,
                });
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({ success: true, ...result });
            }
            catch (error) {
                next(error);
            }
        };
        this.getById = async (req, res, next) => {
            try {
                const data = await this.staffService.getById(req.user.userId, req.user.role, (0, http_decorator_1.getRequiredParam)(req, 'id'));
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({ success: true, data });
            }
            catch (error) {
                next(error);
            }
        };
        this.update = async (req, res, next) => {
            try {
                const file = (0, upload_middleware_1.pickStaffPhotoFile)(req);
                const data = await this.staffService.update(req.user.userId, req.user.role, (0, http_decorator_1.getRequiredParam)(req, 'id'), req.body, file);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({ success: true, message: 'Staff member updated', data });
            }
            catch (error) {
                next(error);
            }
        };
        this.remove = async (req, res, next) => {
            try {
                await this.staffService.remove(req.user.userId, req.user.role, (0, http_decorator_1.getRequiredParam)(req, 'id'));
                res.status(statusCode_interface_1.STATUS_CODE.DELETED).json({ success: true, message: 'Staff member deleted' });
            }
            catch (error) {
                next(error);
            }
        };
    }
    enumQuery(value, values, name) {
        if (typeof value !== 'string' || value.trim() === '')
            return undefined;
        const normalized = value
            .trim()
            .toUpperCase()
            .replace(/[\s-]+/g, '_');
        let alias = normalized;
        if (alias === 'SECURITYGUARD')
            alias = 'SECURITY_GUARD';
        if (alias === 'SECURITY')
            alias = 'GUARD';
        if (alias === 'FULLDAY')
            alias = 'FULL_DAY';
        if (alias === 'ONLEAVE')
            alias = 'ON_LEAVE';
        if (!(alias in values)) {
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.BAD_REQUEST, `${name} is invalid`);
        }
        return alias;
    }
}
exports.StaffController = StaffController;
