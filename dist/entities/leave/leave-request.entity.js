"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: leave-request.entity.ts
// PURPOSE: Stores leave applications submitted by Residents.
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
exports.LeaveRequest = void 0;
const typeorm_1 = require("typeorm");
const resident_entity_1 = require("../resident/resident.entity");
const leave_type_entity_1 = require("./leave-type.entity");
const leave_enum_1 = require("../../enum/leave.enum");
let LeaveRequest = class LeaveRequest {
};
exports.LeaveRequest = LeaveRequest;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], LeaveRequest.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: false }),
    (0, typeorm_1.Index)('idx_leaves_resident_id'),
    __metadata("design:type", String)
], LeaveRequest.prototype, "residentId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => resident_entity_1.Resident, (resident) => resident.leaveRequests, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'residentId' }),
    __metadata("design:type", resident_entity_1.Resident)
], LeaveRequest.prototype, "resident", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: false }),
    (0, typeorm_1.Index)('idx_leaves_type_id'),
    __metadata("design:type", String)
], LeaveRequest.prototype, "leaveTypeId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => leave_type_entity_1.LeaveType, (lt) => lt.leaveRequests, { onDelete: 'RESTRICT' }),
    (0, typeorm_1.JoinColumn)({ name: 'leaveTypeId' }),
    __metadata("design:type", leave_type_entity_1.LeaveType)
], LeaveRequest.prototype, "leaveType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: false }),
    __metadata("design:type", String)
], LeaveRequest.prototype, "startDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: false }),
    __metadata("design:type", String)
], LeaveRequest.prototype, "endDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], LeaveRequest.prototype, "reason", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: leave_enum_1.LeaveStatus, default: leave_enum_1.LeaveStatus.PENDING }),
    (0, typeorm_1.Index)('idx_leaves_status'),
    __metadata("design:type", String)
], LeaveRequest.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], LeaveRequest.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], LeaveRequest.prototype, "updatedAt", void 0);
exports.LeaveRequest = LeaveRequest = __decorate([
    (0, typeorm_1.Entity)('leave_requests'),
    (0, typeorm_1.Index)('idx_leaves_resident_status_dates', ['residentId', 'status', 'startDate', 'endDate'])
], LeaveRequest);
