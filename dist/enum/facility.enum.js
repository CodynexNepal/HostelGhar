"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: facility.enum.ts
// PURPOSE: Central enum for hostel facility tags (normalized status labels).
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.FacilityTag = void 0;
var FacilityTag;
(function (FacilityTag) {
    FacilityTag["INCLUDED"] = "Included";
    FacilityTag["EXCLUDED"] = "Excluded";
    FacilityTag["EXTRA_CHARGE"] = "Extra Charge";
})(FacilityTag || (exports.FacilityTag = FacilityTag = {}));
