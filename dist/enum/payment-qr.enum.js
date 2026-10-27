"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: payment-qr.enum.ts
// PURPOSE: Enums for Hostel Payment QR Codes (eSewa, Khalti, Bank Transfer).
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentMethod = void 0;
var PaymentMethod;
(function (PaymentMethod) {
    PaymentMethod["ESEWA"] = "ESEWA";
    PaymentMethod["KHALTI"] = "KHALTI";
    PaymentMethod["BANK_TRANSFER"] = "BANK_TRANSFER";
})(PaymentMethod || (exports.PaymentMethod = PaymentMethod = {}));
