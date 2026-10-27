"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: platform-qr.enum.ts
// PURPOSE: Payment methods for Hostel Ghar PLATFORM checkout QRs — the official
//          accounts owners pay TO when buying a subscription (eSewa / Khalti / Bank).
//          Intentionally separate from `payment-qr.enum.ts` (hostel QRs), whose
//          bank value is `BANK_TRANSFER`; the platform contract uses `BANK`.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlatformQrMethod = void 0;
var PlatformQrMethod;
(function (PlatformQrMethod) {
    PlatformQrMethod["ESEWA"] = "ESEWA";
    PlatformQrMethod["KHALTI"] = "KHALTI";
    PlatformQrMethod["BANK"] = "BANK";
})(PlatformQrMethod || (exports.PlatformQrMethod = PlatformQrMethod = {}));
