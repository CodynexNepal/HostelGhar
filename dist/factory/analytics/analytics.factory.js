"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsFactory = void 0;
const analytics_controller_1 = require("../../controller/analytics/analytics.controller");
const analytics_repository_1 = require("../../repository/analytics/analytics.repository");
const analytics_services_1 = require("../../services/analytics/analytics.services");
class AnalyticsFactory {
    constructor() { }
    static create() {
        const analyticsRepository = new analytics_repository_1.AnalyticsRepository();
        const analyticsService = new analytics_services_1.AnalyticsService(analyticsRepository);
        return new analytics_controller_1.AnalyticsController(analyticsService);
    }
}
exports.AnalyticsFactory = AnalyticsFactory;
