"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: booking.enum.ts
// PURPOSE: Enum defining hostel booking workflow statuses.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookingStatus = void 0;
var BookingStatus;
(function (BookingStatus) {
    BookingStatus["PENDING"] = "PENDING";
    BookingStatus["APPROVED"] = "APPROVED";
    BookingStatus["CONFIRMED"] = "CONFIRMED";
    BookingStatus["CANCELLED"] = "CANCELLED";
    BookingStatus["REJECTED"] = "REJECTED";
})(BookingStatus || (exports.BookingStatus = BookingStatus = {}));
