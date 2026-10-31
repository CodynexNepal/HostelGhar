"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: payment.routes.ts
// PURPOSE: Dedicated endpoints for payment receipts and audit history.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentRouter = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const http_decorator_1 = require("../../decorators/http.decorator");
const payment_controller_1 = require("../../controller/payment/payment.controller");
const paymentRouter = (0, express_1.Router)();
exports.paymentRouter = paymentRouter;
paymentRouter.use(auth_middleware_1.authenticate);
paymentRouter.get('/:id/receipt', (0, http_decorator_1.requireParam)('id'), payment_controller_1.paymentController.getReceipt);
