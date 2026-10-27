"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: staff.enum.ts
// PURPOSE: Staff role / shift / status enumerations for hostel staff management.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.StaffStatus = exports.StaffShift = exports.StaffRole = void 0;
var StaffRole;
(function (StaffRole) {
    StaffRole["WARDEN"] = "WARDEN";
    StaffRole["MANAGER"] = "MANAGER";
    StaffRole["COOK"] = "COOK";
    StaffRole["CLEANER"] = "CLEANER";
    StaffRole["GUARD"] = "GUARD";
    StaffRole["SECURITY_GUARD"] = "SECURITY_GUARD";
    StaffRole["ACCOUNTANT"] = "ACCOUNTANT";
    StaffRole["RECEPTIONIST"] = "RECEPTIONIST";
    StaffRole["MAINTENANCE"] = "MAINTENANCE";
    StaffRole["DRIVER"] = "DRIVER";
    StaffRole["OTHER"] = "OTHER";
})(StaffRole || (exports.StaffRole = StaffRole = {}));
var StaffShift;
(function (StaffShift) {
    StaffShift["DAY"] = "DAY";
    StaffShift["NIGHT"] = "NIGHT";
    StaffShift["MORNING"] = "MORNING";
    StaffShift["EVENING"] = "EVENING";
    StaffShift["FULL_DAY"] = "FULL_DAY";
})(StaffShift || (exports.StaffShift = StaffShift = {}));
var StaffStatus;
(function (StaffStatus) {
    StaffStatus["ACTIVE"] = "ACTIVE";
    StaffStatus["INACTIVE"] = "INACTIVE";
    StaffStatus["ON_LEAVE"] = "ON_LEAVE";
    StaffStatus["TERMINATED"] = "TERMINATED";
})(StaffStatus || (exports.StaffStatus = StaffStatus = {}));
