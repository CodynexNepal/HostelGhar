"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: apply-leave.dto.ts
// PURPOSE: Request validation DTO for Resident applying for leave.
// Supports BOTH naming conventions so frontend/backend can never drift:
//   canonical:  leaveTypeId + startDate + endDate + reason
//   legacy UI:  leaveTypeId + fromDate  + toDate   + remarks
// The controller normalizes aliases -> canonical before saving.
// ──────────────────────────────────────────────────────────────────────────────
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApplyLeaveDto = void 0;
const class_validator_1 = require("class-validator");
class ApplyLeaveDto {
}
exports.ApplyLeaveDto = ApplyLeaveDto;
__decorate([
    (0, class_validator_1.IsUUID)('4', { message: 'Leave Type ID must be a valid UUID' }),
    __metadata("design:type", String)
], ApplyLeaveDto.prototype, "leaveTypeId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)({}, { message: 'Start date must be a valid ISO date string (YYYY-MM-DD)' }),
    __metadata("design:type", String)
], ApplyLeaveDto.prototype, "startDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)({}, { message: 'End date must be a valid ISO date string (YYYY-MM-DD)' }),
    __metadata("design:type", String)
], ApplyLeaveDto.prototype, "endDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'Reason must be a string' }),
    __metadata("design:type", String)
], ApplyLeaveDto.prototype, "reason", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)({}, { message: 'From date must be a valid ISO date string (YYYY-MM-DD)' }),
    __metadata("design:type", String)
], ApplyLeaveDto.prototype, "fromDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)({}, { message: 'To date must be a valid ISO date string (YYYY-MM-DD)' }),
    __metadata("design:type", String)
], ApplyLeaveDto.prototype, "toDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'Remarks must be a string' }),
    __metadata("design:type", String)
], ApplyLeaveDto.prototype, "remarks", void 0);
