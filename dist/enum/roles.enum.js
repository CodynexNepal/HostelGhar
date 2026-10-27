"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: roles.enum.ts
// PURPOSE: Centralized application roles enumeration.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.IROLES = void 0;
var IROLES;
(function (IROLES) {
    IROLES["ADMIN"] = "admin";
    IROLES["OWNER"] = "owner";
    IROLES["USER"] = "user";
    IROLES["RESIDENT"] = "resident";
})(IROLES || (exports.IROLES = IROLES = {}));
