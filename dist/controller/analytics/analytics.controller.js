"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsController = void 0;
const statusCode_interface_1 = require("../../constant/statusCode.interface");
class AnalyticsController {
    constructor(analyticsService) {
        this.analyticsService = analyticsService;
        /**
         * Bootstrap for the admin dashboard page. `?refresh=1|true` forces a live DB
         * read (bypasses L1/L2) so the dashboard's Refresh button always re-reads.
         */
        this.adminDashboard = async (req, res, next) => {
            try {
                const { data, isCached, cacheLevel } = await this.analyticsService.getAdminDashboard({
                    refresh: req.query.refresh === '1' || req.query.refresh === 'true',
                });
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    isCached,
                    cacheLevel,
                    data,
                });
            }
            catch (error) {
                next(error);
            }
        };
        // Legacy alias of adminDashboard: identical payload (MRR included) so a client
        // pointed at /admin/dashboard/summary or /analytics/admin/summary still gets it.
        this.adminSummary = async (req, res, next) => {
            try {
                const { data, isCached, cacheLevel } = await this.analyticsService.getAdminSummary({
                    refresh: req.query.refresh === '1' || req.query.refresh === 'true',
                });
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    isCached,
                    cacheLevel,
                    data,
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.ownerSummary = async (req, res, next) => {
            try {
                const { data, isCached, cacheLevel } = await this.analyticsService.getOwnerSummary(req.user.userId);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    isCached,
                    cacheLevel,
                    data,
                });
            }
            catch (error) {
                next(error);
            }
        };
    }
}
exports.AnalyticsController = AnalyticsController;
