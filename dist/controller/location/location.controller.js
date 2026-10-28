"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: location.controller.ts
// PURPOSE: HTTP layer for hostel location sharing and coordinates endpoints.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocationController = void 0;
const statusCode_interface_1 = require("../../constant/statusCode.interface");
const http_decorator_1 = require("../../decorators/http.decorator");
class LocationController {
    constructor(locationService) {
        this.locationService = locationService;
        this.getLocation = async (req, res, next) => {
            try {
                const hostelId = (0, http_decorator_1.getRequiredParam)(req, 'hostelId');
                const user = req.user
                    ? {
                        userId: req.user.userId,
                        role: req.user.role ?? '',
                    }
                    : undefined;
                const result = await this.locationService.getLocation(hostelId, user);
                if (result.error) {
                    res.status(result.error.status).json({ success: false, message: result.error.message });
                    return;
                }
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    data: result.data,
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.updateLocation = async (req, res, next) => {
            try {
                const hostelId = (0, http_decorator_1.getRequiredParam)(req, 'hostelId');
                const user = {
                    userId: req.user.userId,
                    role: req.user.role ?? '',
                };
                const dto = req.body;
                const result = await this.locationService.updateLocation(hostelId, user, dto);
                if (result.error) {
                    res.status(result.error.status).json({ success: false, message: result.error.message });
                    return;
                }
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    message: 'Hostel location updated successfully',
                    data: result.data,
                });
            }
            catch (error) {
                next(error);
            }
        };
    }
}
exports.LocationController = LocationController;
