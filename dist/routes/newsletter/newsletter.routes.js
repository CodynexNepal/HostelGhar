"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.newsletterRouter = void 0;
const express_1 = require("express");
const newsletter_controller_1 = require("../../controller/newsletter/newsletter.controller");
const newsletter_service_1 = require("../../services/newsletter/newsletter.service");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const roles_enum_1 = require("../../enum/roles.enum");
const rateLimiter_config_1 = require("../../configs/rateLimiter.config");
exports.newsletterRouter = (0, express_1.Router)();
const newsletterService = new newsletter_service_1.NewsletterService();
const newsletterController = new newsletter_controller_1.NewsletterController(newsletterService);
// Public route to subscribe
exports.newsletterRouter.post('/subscribe', newsletterController.subscribe);
// Public route to unsubscribe
exports.newsletterRouter.post('/unsubscribe', newsletterController.unsubscribe);
// Admin-only route to list subscribers
exports.newsletterRouter.get('/', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRoles)(roles_enum_1.IROLES.ADMIN), rateLimiter_config_1.apiReadLimiter, newsletterController.list);
// Admin-only route to update subscriber status
exports.newsletterRouter.patch('/:id/status', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRoles)(roles_enum_1.IROLES.ADMIN), newsletterController.updateStatus);
// Admin-only route to delete a subscriber
exports.newsletterRouter.delete('/:id', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRoles)(roles_enum_1.IROLES.ADMIN), newsletterController.delete);
