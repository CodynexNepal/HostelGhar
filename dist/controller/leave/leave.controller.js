"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeaveController = void 0;
const statusCode_interface_1 = require("../../constant/statusCode.interface");
const http_decorator_1 = require("../../decorators/http.decorator");
const pagination_util_1 = require("../../utils/pagination.util");
class LeaveController {
    constructor(leaveService) {
        this.leaveService = leaveService;
        this.listHostelLeaves = async (req, res, next) => {
            try {
                const hostelId = (0, http_decorator_1.getRequiredParam)(req, 'hostelId');
                const { page, limit } = (0, pagination_util_1.normalizePagination)({
                    page: req.query.page,
                    limit: req.query.limit,
                });
                const result = await this.leaveService.listHostelLeaves(hostelId, req.query.status, page, limit);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({ success: true, ...result });
            }
            catch (error) {
                next(error);
            }
        };
        this.updateStatus = async (req, res, next) => {
            try {
                const leaveId = (0, http_decorator_1.getRequiredParam)(req, 'id');
                const result = await this.leaveService.updateLeaveStatus(leaveId, req.body.status, req.user.userId);
                if (result.error) {
                    res.status(result.error.status).json({ success: false, message: result.error.message });
                    return;
                }
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({ success: true, data: result.data });
            }
            catch (error) {
                next(error);
            }
        };
    }
}
exports.LeaveController = LeaveController;
