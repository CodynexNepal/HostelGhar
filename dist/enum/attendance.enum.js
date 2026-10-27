"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: attendance.enum.ts
// PURPOSE: Resident attendance status enumerations (daily check-in records).
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttendanceStatus = void 0;
var AttendanceStatus;
(function (AttendanceStatus) {
    AttendanceStatus["PRESENT"] = "PRESENT";
    AttendanceStatus["ABSENT"] = "ABSENT";
    AttendanceStatus["LATE"] = "LATE";
    AttendanceStatus["HALF_DAY"] = "HALF_DAY";
    AttendanceStatus["ON_LEAVE"] = "ON_LEAVE";
})(AttendanceStatus || (exports.AttendanceStatus = AttendanceStatus = {}));
