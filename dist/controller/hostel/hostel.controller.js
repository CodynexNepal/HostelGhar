"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HostelController = void 0;
const statusCode_interface_1 = require("../../constant/statusCode.interface");
const http_decorator_1 = require("../../decorators/http.decorator");
const pagination_util_1 = require("../../utils/pagination.util");
class HostelController {
    constructor(hostelService) {
        this.hostelService = hostelService;
        this.listHostels = async (req, res, next) => {
            try {
                const { page, limit } = (0, pagination_util_1.normalizePagination)({
                    page: req.query.page,
                    limit: req.query.limit,
                });
                const result = await this.hostelService.listHostels(page, limit);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({ success: true, ...result });
            }
            catch (error) {
                next(error);
            }
        };
        this.getHostel = async (req, res, next) => {
            try {
                const hostelId = (0, http_decorator_1.getRequiredParam)(req, 'id');
                const result = await this.hostelService.getHostel(hostelId);
                if (result.error) {
                    res.status(result.error.status).json({ success: false, message: result.error.message });
                    return;
                }
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    data: result.data,
                    isCached: result.isCached,
                    cacheLevel: result.cacheLevel,
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.getResidents = async (req, res, next) => {
            try {
                const hostelId = (0, http_decorator_1.getRequiredParam)(req, 'id');
                const result = await this.hostelService.getHostelResidents(hostelId, {
                    userId: req.user.userId,
                    role: req.user.role ?? '',
                });
                if ('error' in result && result.error) {
                    res.status(result.error.status).json({ success: false, message: result.error.message });
                    return;
                }
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({ success: true, ...result });
            }
            catch (error) {
                next(error);
            }
        };
        this.getLeaveTypes = async (req, res, next) => {
            try {
                const hostelId = (0, http_decorator_1.getRequiredParam)(req, 'id');
                const result = await this.hostelService.getHostelLeaveTypes(hostelId);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({ success: true, ...result });
            }
            catch (error) {
                next(error);
            }
        };
        this.addRating = async (req, res, next) => {
            try {
                const hostelId = (0, http_decorator_1.getRequiredParam)(req, 'id');
                const { rating, comment } = req.body;
                const userId = req.user?.userId;
                const result = await this.hostelService.addRating(hostelId, Number(rating), comment, userId);
                if (result.error) {
                    res.status(result.error.status).json({ success: false, message: result.error.message });
                    return;
                }
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({ success: true, ...result });
            }
            catch (error) {
                next(error);
            }
        };
        this.getRatings = async (req, res, next) => {
            try {
                const hostelId = (0, http_decorator_1.getRequiredParam)(req, 'id');
                const result = await this.hostelService.getRatings(hostelId);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({ success: true, ...result });
            }
            catch (error) {
                next(error);
            }
        };
    }
}
exports.HostelController = HostelController;
