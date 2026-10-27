"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: payment-qr.factory.ts
// PURPOSE: Factory to instantiate PaymentQrController with its dependencies.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentQrFactory = void 0;
const payment_qr_controller_1 = require("../../controller/payment-qr/payment-qr.controller");
const payment_qr_repository_1 = require("../../repository/payment-qr/payment-qr.repository");
const payment_qr_service_1 = require("../../services/payment-qr/payment-qr.service");
class PaymentQrFactory {
    constructor() { }
    static create() {
        const repository = new payment_qr_repository_1.PaymentQrRepository();
        const service = new payment_qr_service_1.PaymentQrService(repository);
        return new payment_qr_controller_1.PaymentQrController(service);
    }
}
exports.PaymentQrFactory = PaymentQrFactory;
