"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: create-leave-type.dto.ts
// PURPOSE: Request validation DTO for Owner creating a Leave Type policy for their Hostel.
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
exports.CreateLeaveTypeDto = void 0;
const class_validator_1 = require("class-validator");
class CreateLeaveTypeDto {
}
exports.CreateLeaveTypeDto = CreateLeaveTypeDto;
__decorate([
    (0, class_validator_1.IsUUID)('4', { message: 'Hostel ID must be a valid UUID' }),
    __metadata("design:type", String)
], CreateLeaveTypeDto.prototype, "hostelId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'Leave type name is required (e.g. Sick Leave, Vacation)' }),
    __metadata("design:type", String)
], CreateLeaveTypeDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsInt)({ message: 'Max days must be an integer' }),
    (0, class_validator_1.Min)(1, { message: 'Max days must be at least 1' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], CreateLeaveTypeDto.prototype, "maxDays", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)({ message: 'requiresParentApproval must be a boolean' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], CreateLeaveTypeDto.prototype, "requiresParentApproval", void 0);
