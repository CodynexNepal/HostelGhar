"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contactRouter = void 0;
const express_1 = require("express");
const contact_controller_1 = require("../../controller/contact/contact.controller");
const contact_service_1 = require("../../services/contact/contact.service");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const roles_enum_1 = require("../../enum/roles.enum");
const rateLimiter_config_1 = require("../../configs/rateLimiter.config");
exports.contactRouter = (0, express_1.Router)();
const contactService = new contact_service_1.ContactService();
const contactController = new contact_controller_1.ContactController(contactService);
// Public route to submit a contact inquiry
exports.contactRouter.post('/', contactController.submit);
// Admin-only route to list messages
exports.contactRouter.get('/', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRoles)(roles_enum_1.IROLES.ADMIN), rateLimiter_config_1.apiReadLimiter, contactController.list);
