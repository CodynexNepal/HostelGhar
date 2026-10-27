"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: fee.enum.ts
// PURPOSE: Enums defining fee cycle, types, and payment statuses.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeeType = exports.FeeStatus = void 0;
var FeeStatus;
(function (FeeStatus) {
    FeeStatus["PENDING"] = "PENDING";
    FeeStatus["PAID"] = "PAID";
    FeeStatus["OVERDUE"] = "OVERDUE";
    FeeStatus["PARTIALLY_PAID"] = "PARTIALLY_PAID";
})(FeeStatus || (exports.FeeStatus = FeeStatus = {}));
var FeeType;
(function (FeeType) {
    FeeType["MONTHLY_HOSTEL_FEE"] = "MONTHLY_HOSTEL_FEE";
    FeeType["MAINTENANCE"] = "MAINTENANCE";
    FeeType["ADMISSION_FEE"] = "ADMISSION_FEE";
    FeeType["FINE"] = "FINE";
})(FeeType || (exports.FeeType = FeeType = {}));
