"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: payment.enum.ts
// PURPOSE: Enums defining payment methods and transaction lifecycle statuses.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentStatus = exports.PaymentMethod = void 0;
var PaymentMethod;
(function (PaymentMethod) {
    PaymentMethod["CASH"] = "CASH";
    PaymentMethod["ESEWA"] = "ESEWA";
    PaymentMethod["KHALTI"] = "KHALTI";
    PaymentMethod["BANK_TRANSFER"] = "BANK_TRANSFER";
    PaymentMethod["OTHER"] = "OTHER";
})(PaymentMethod || (exports.PaymentMethod = PaymentMethod = {}));
var PaymentStatus;
(function (PaymentStatus) {
    PaymentStatus["PENDING"] = "PENDING";
    PaymentStatus["SUCCESS"] = "SUCCESS";
    PaymentStatus["FAILED"] = "FAILED";
    PaymentStatus["REFUNDED"] = "REFUNDED";
})(PaymentStatus || (exports.PaymentStatus = PaymentStatus = {}));
