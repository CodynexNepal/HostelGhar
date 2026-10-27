"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BedController = void 0;
const statusCode_interface_1 = require("../../constant/statusCode.interface");
class BedController {
    constructor(bedService) {
        this.bedService = bedService;
        this.listBeds = async (req, res, next) => {
            try {
                const ownerId = req.user.userId;
                const hostelId = typeof req.query.hostelId === 'string' ? req.query.hostelId : undefined;
                const result = await this.bedService.listBeds(ownerId, hostelId);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    data: result.data,
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.createBed = async (req, res, next) => {
            try {
                const ownerId = req.user.userId;
                const dto = req.body;
                const result = await this.bedService.createBed(ownerId, dto);
                if (result.error) {
                    res.status(result.error.status).json({ success: false, message: result.error.message });
                    return;
                }
                res.status(statusCode_interface_1.STATUS_CODE.CREATED).json({
                    success: true,
                    message: 'Bed added successfully',
                    data: result.data,
                });
            }
            catch (error) {
                next(error);
            }
        };
    }
}
exports.BedController = BedController;
