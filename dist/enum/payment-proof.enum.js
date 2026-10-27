"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: payment-proof.enum.ts
// PURPOSE: Enums for resident-submitted payment proofs (screenshot receipts)
//          that hostel owners/admins review before marking a fee paid.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProofReviewAction = exports.ProofPaymentMethod = exports.PaymentProofStatus = void 0;
/**
 * Review lifecycle of an uploaded payment proof.
 * PENDING → APPROVED | REJECTED (owner/admin action).
 */
var PaymentProofStatus;
(function (PaymentProofStatus) {
    PaymentProofStatus["PENDING"] = "PENDING";
    PaymentProofStatus["APPROVED"] = "APPROVED";
    PaymentProofStatus["REJECTED"] = "REJECTED";
})(PaymentProofStatus || (exports.PaymentProofStatus = PaymentProofStatus = {}));
/**
 * How the resident paid. Kept separate from `PaymentMethod` (payment-qr) on
 * purpose: the dashboard proof dialog offers ESEWA | KHALTI | BANK | CASH,
 * while QR codes only support wallet/bank-transfer providers.
 */
var ProofPaymentMethod;
(function (ProofPaymentMethod) {
    ProofPaymentMethod["ESEWA"] = "ESEWA";
    ProofPaymentMethod["KHALTI"] = "KHALTI";
    ProofPaymentMethod["BANK"] = "BANK";
    ProofPaymentMethod["CASH"] = "CASH";
})(ProofPaymentMethod || (exports.ProofPaymentMethod = ProofPaymentMethod = {}));
/** Action sent by the reviewer: PATCH /payment-proofs/:id/review. */
var ProofReviewAction;
(function (ProofReviewAction) {
    ProofReviewAction["APPROVE"] = "APPROVE";
    ProofReviewAction["REJECT"] = "REJECT";
})(ProofReviewAction || (exports.ProofReviewAction = ProofReviewAction = {}));
