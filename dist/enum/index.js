"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: index.ts (or enum.ts)
// PURPOSE: Central export barrel for all application enums.
// ──────────────────────────────────────────────────────────────────────────────
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
__exportStar(require("./roles.enum"), exports);
__exportStar(require("./hostel.enum"), exports);
__exportStar(require("./leave.enum"), exports);
__exportStar(require("./booking.enum"), exports);
__exportStar(require("./fee.enum"), exports);
__exportStar(require("./room.enum"), exports);
__exportStar(require("./facility.enum"), exports);
__exportStar(require("./payment-qr.enum"), exports);
__exportStar(require("./platform-qr.enum"), exports);
__exportStar(require("./payment-proof.enum"), exports);
__exportStar(require("./subscription.enum"), exports);
__exportStar(require("./staff.enum"), exports);
