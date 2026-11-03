"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.newsletterRouter = void 0;
const express_1 = require("express");
const newsletter_controller_1 = require("../../controller/newsletter/newsletter.controller");
const newsletter_service_1 = require("../../services/newsletter/newsletter.service");
exports.newsletterRouter = (0, express_1.Router)();
const newsletterService = new newsletter_service_1.NewsletterService();
const newsletterController = new newsletter_controller_1.NewsletterController(newsletterService);
// Public route to subscribe
exports.newsletterRouter.post('/subscribe', newsletterController.subscribe);
// Public route to unsubscribe
exports.newsletterRouter.post('/unsubscribe', newsletterController.unsubscribe);
