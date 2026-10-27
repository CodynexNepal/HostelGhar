"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsRouter = void 0;
const express_1 = require("express");
const analytics_factory_1 = require("../../factory/analytics/analytics.factory");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const roles_enum_1 = require("../../enum/roles.enum");
const rateLimiter_config_1 = require("../../configs/rateLimiter.config");
const analyticsRouter = (0, express_1.Router)();
exports.analyticsRouter = analyticsRouter;
const analyticsController = analytics_factory_1.AnalyticsFactory.create();
analyticsRouter.use(auth_middleware_1.authenticate, rateLimiter_config_1.apiReadLimiter);
analyticsRouter.get('/admin/summary', (0, auth_middleware_1.requireRoles)(roles_enum_1.IROLES.ADMIN), analyticsController.adminSummary);
// Same payload as GET /admin/dashboard, for analytics clients that hit this router.
analyticsRouter.get('/admin/dashboard', (0, auth_middleware_1.requireRoles)(roles_enum_1.IROLES.ADMIN), analyticsController.adminDashboard);
analyticsRouter.get('/owner/summary', (0, auth_middleware_1.requireRoles)(roles_enum_1.IROLES.OWNER, roles_enum_1.IROLES.ADMIN), analyticsController.ownerSummary);
