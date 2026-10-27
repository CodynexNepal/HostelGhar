"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: create-invoice.dto.ts
// PURPOSE: Validation for Owner/Admin manually creating one resident invoice.
// Accepts EITHER residentId OR residentName (+hotel scoping), flexible billing
// month shapes ("2026-09", "September 2026", 9), and amount/dueDate/status
// aliases so the dashboard "Create invoice" form never 422s on key names.
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
exports.CreateInvoiceDto = exports.InvoiceSendMode = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const fee_enum_1 = require("../../enum/fee.enum");
/** Invoice send mode: DRAFT saves silently, SEND_NOW also emails the resident. */
var InvoiceSendMode;
(function (InvoiceSendMode) {
    InvoiceSendMode["DRAFT"] = "DRAFT";
    InvoiceSendMode["SEND_NOW"] = "SEND_NOW";
})(InvoiceSendMode || (exports.InvoiceSendMode = InvoiceSendMode = {}));
class CreateInvoiceDto {
}
exports.CreateInvoiceDto = CreateInvoiceDto;
__decorate([
    (0, class_validator_1.ValidateIf)((_o, v) => v !== undefined && v !== null && v !== ''),
    (0, class_validator_1.IsUUID)('4', { message: 'hostelId must be a valid UUID' }),
    __metadata("design:type", String)
], CreateInvoiceDto.prototype, "hostelId", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((_o, v) => v !== undefined && v !== null && v !== ''),
    (0, class_validator_1.IsUUID)('4', { message: 'residentId must be a valid UUID' }),
    __metadata("design:type", String)
], CreateInvoiceDto.prototype, "residentId", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((_o, v) => v !== undefined && v !== null && v !== ''),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2, { message: 'Resident name must be at least 2 characters' }),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CreateInvoiceDto.prototype, "residentName", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((_o, v) => v !== undefined && v !== null && v !== ''),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CreateInvoiceDto.prototype, "resident_name", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((_o, v) => v !== undefined && v !== null && v !== ''),
    (0, class_validator_1.IsEmail)({}, { message: 'residentEmail must be valid' }),
    (0, class_validator_1.MaxLength)(255),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateInvoiceDto.prototype, "residentEmail", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'Billing month is required' }),
    __metadata("design:type", Object)
], CreateInvoiceDto.prototype, "billingMonth", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((_o, v) => v !== undefined && v !== null && v !== ''),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)({ message: 'billingYear must be an integer year' }),
    (0, class_validator_1.Min)(2000),
    (0, class_validator_1.Max)(2100),
    __metadata("design:type", Number)
], CreateInvoiceDto.prototype, "billingYear", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((_o, v) => v !== undefined && v !== null && v !== ''),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({}, { message: 'amount must be a number' }),
    (0, class_validator_1.IsPositive)({ message: 'amount must be positive' }),
    __metadata("design:type", Number)
], CreateInvoiceDto.prototype, "amount", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((_o, v) => v !== undefined && v !== null && v !== ''),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({}, { message: 'total must be a number' }),
    (0, class_validator_1.IsPositive)({ message: 'total must be positive' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], CreateInvoiceDto.prototype, "total", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((_o, v) => v !== undefined && v !== null && v !== ''),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({}, { message: 'totalPayable must be a number' }),
    (0, class_validator_1.IsPositive)({ message: 'totalPayable must be positive' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], CreateInvoiceDto.prototype, "totalPayable", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'Due date is required' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateInvoiceDto.prototype, "dueDate", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((_o, v) => v !== undefined && v !== null && v !== ''),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateInvoiceDto.prototype, "due_date", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(30),
    __metadata("design:type", String)
], CreateInvoiceDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(30),
    __metadata("design:type", String)
], CreateInvoiceDto.prototype, "sendMode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], CreateInvoiceDto.prototype, "sendNow", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(fee_enum_1.FeeStatus, { message: 'feeStatus must be a valid fee status' }),
    __metadata("design:type", String)
], CreateInvoiceDto.prototype, "feeStatus", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(30),
    __metadata("design:type", String)
], CreateInvoiceDto.prototype, "paymentStatus", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(30),
    __metadata("design:type", String)
], CreateInvoiceDto.prototype, "payment_status", void 0);
