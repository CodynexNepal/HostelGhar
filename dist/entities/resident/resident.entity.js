"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: resident.entity.ts
// PURPOSE: Stores Resident specific profile, mapped 1:1 to User and Many:1 to Hostel.
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
exports.Resident = void 0;
const typeorm_1 = require("typeorm");
const user_entity_1 = require("../user.entity");
const hostel_entity_1 = require("../hostel/hostel.entity");
const leave_request_entity_1 = require("../leave/leave-request.entity");
let Resident = class Resident {
};
exports.Resident = Resident;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Resident.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', unique: true, nullable: false }),
    __metadata("design:type", String)
], Resident.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => user_entity_1.User, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'userId' }),
    __metadata("design:type", user_entity_1.User)
], Resident.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: false }),
    (0, typeorm_1.Index)('idx_residents_hostel_id'),
    __metadata("design:type", String)
], Resident.prototype, "hostelId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => hostel_entity_1.Hostel, (hostel) => hostel.residents, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'hostelId' }),
    __metadata("design:type", hostel_entity_1.Hostel)
], Resident.prototype, "hostel", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: false }),
    __metadata("design:type", String)
], Resident.prototype, "roomNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: true, default: null }),
    __metadata("design:type", Object)
], Resident.prototype, "bedNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'numeric', precision: 12, scale: 2, nullable: true, default: null }),
    __metadata("design:type", Object)
], Resident.prototype, "monthlyRent", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 500, nullable: true, default: null }),
    __metadata("design:type", Object)
], Resident.prototype, "photoUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true, default: null }),
    __metadata("design:type", Object)
], Resident.prototype, "photoPublicId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 500, nullable: true, default: null }),
    __metadata("design:type", Object)
], Resident.prototype, "documentUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true, default: null }),
    __metadata("design:type", Object)
], Resident.prototype, "documentPublicId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], Resident.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => leave_request_entity_1.LeaveRequest, (lr) => lr.resident),
    __metadata("design:type", Array)
], Resident.prototype, "leaveRequests", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], Resident.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], Resident.prototype, "updatedAt", void 0);
exports.Resident = Resident = __decorate([
    (0, typeorm_1.Entity)('residents'),
    (0, typeorm_1.Index)('idx_residents_hostel_active', ['hostelId', 'isActive'])
], Resident);
