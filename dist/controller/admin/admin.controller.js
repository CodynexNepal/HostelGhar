"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: admin.controller.ts
// PURPOSE: Admin HTTP Controller delegating entirely to AdminService.
//          Follows strict Controller -> Service -> Repository -> Database flow.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminController = void 0;
const statusCode_interface_1 = require("../../constant/statusCode.interface");
const http_decorator_1 = require("../../decorators/http.decorator");
const pagination_util_1 = require("../../utils/pagination.util");
const upload_middleware_1 = require("../../middleware/upload.middleware");
const createHttpError_1 = require("../../utils/createHttpError");
class AdminController {
    constructor(adminService) {
        this.adminService = adminService;
        this.createOwner = async (req, res, next) => {
            try {
                const owner = await this.adminService.createOwner(req.body, req.file);
                res.status(statusCode_interface_1.STATUS_CODE.CREATED).json({
                    success: true,
                    message: 'Owner created. Login credentials were queued for delivery by email.',
                    data: { owner },
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.createHostel = async (req, res, next) => {
            try {
                const dto = req.body;
                const adminId = req.user.userId;
                // Multer `.fields()` populates req.files (never req.file) — accept
                // the file under either the `logo` or `image` field name.
                const logoFile = (0, upload_middleware_1.pickHostelLogoFile)(req);
                const result = await this.adminService.createHostel(adminId, dto, logoFile);
                res.status(statusCode_interface_1.STATUS_CODE.CREATED).json({
                    success: true,
                    message: result.message,
                    data: result.data,
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.getAllHostels = async (req, res, next) => {
            try {
                const { page, limit } = (0, pagination_util_1.normalizePagination)({
                    page: req.query.page,
                    limit: req.query.limit,
                });
                const paginatedResult = await this.adminService.getAllHostels(page, limit);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    ...paginatedResult,
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.invalidateHostelCache = async (_req, res, next) => {
            try {
                await this.adminService.invalidateHostelListCache();
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    message: 'Hostel list cache invalidated successfully',
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.assignHostelOwner = async (req, res, next) => {
            try {
                const hostelId = (0, http_decorator_1.getRequiredParam)(req, 'id');
                const dto = req.body;
                const adminId = req.user.userId;
                const result = await this.adminService.assignHostelOwner(hostelId, dto.ownerId, adminId);
                if (result.error) {
                    res.status(result.error.status).json({ success: false, message: result.error.message });
                    return;
                }
                res.status(statusCode_interface_1.STATUS_CODE.UPDATED).json({ success: true, data: result.data });
            }
            catch (error) {
                next(error);
            }
        };
        this.uploadLogo = async (req, res, next) => {
            try {
                const hostelId = (0, http_decorator_1.getRequiredParam)(req, 'id');
                const logoFile = (0, upload_middleware_1.pickHostelLogoFile)(req);
                if (!logoFile) {
                    throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.BAD_REQUEST, 'Logo file is required in field "logo" or "image"');
                }
                const result = await this.adminService.uploadHostelLogo(hostelId, logoFile);
                if (result.error) {
                    res.status(result.error.status).json({ success: false, message: result.error.message });
                    return;
                }
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    message: 'Hostel logo uploaded successfully',
                    data: result.data,
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.suspendHostel = async (req, res, next) => {
            try {
                const hostelId = (0, http_decorator_1.getRequiredParam)(req, 'id');
                const dto = req.body;
                const adminId = req.user.userId;
                const result = await this.adminService.suspendHostel(hostelId, adminId, dto?.reason);
                if (result.error) {
                    res.status(result.error.status).json({ success: false, message: result.error.message });
                    return;
                }
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    message: 'Hostel suspended successfully',
                    data: result.data,
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.reactivateHostel = async (req, res, next) => {
            try {
                const hostelId = (0, http_decorator_1.getRequiredParam)(req, 'id');
                const adminId = req.user.userId;
                const result = await this.adminService.reactivateHostel(hostelId, adminId);
                if (result.error) {
                    res.status(result.error.status).json({ success: false, message: result.error.message });
                    return;
                }
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    message: 'Hostel reactivated successfully',
                    data: result.data,
                });
            }
            catch (error) {
                next(error);
            }
        };
    }
}
exports.AdminController = AdminController;
