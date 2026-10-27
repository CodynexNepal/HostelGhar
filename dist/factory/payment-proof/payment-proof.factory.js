"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentProofFactory = void 0;
const payment_proof_controller_1 = require("../../controller/payment-proof/payment-proof.controller");
const payment_proof_repository_1 = require("../../repository/payment-proof/payment-proof.repository");
const payment_proof_service_1 = require("../../services/payment-proof/payment-proof.service");
class PaymentProofFactory {
    constructor() { }
    static create() {
        const repository = new payment_proof_repository_1.PaymentProofRepository();
        const service = new payment_proof_service_1.PaymentProofService(repository);
        return new payment_proof_controller_1.PaymentProofController(service);
    }
}
exports.PaymentProofFactory = PaymentProofFactory;
