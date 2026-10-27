"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: hostel-facility.entity.ts
// PURPOSE: Junction table hostel_facilities (hostel M:N facility).
//          Holds ONLY per-hostel facts: description + tag + clientKey.
//          Title/slug live once in facilities (no data redundancy).
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
exports.HostelFacility = void 0;
const typeorm_1 = require("typeorm");
const hostel_entity_1 = require("../hostel/hostel.entity");
const facility_entity_1 = require("./facility.entity");
const facility_enum_1 = require("../../enum/facility.enum");
let HostelFacility = class HostelFacility {
};
exports.HostelFacility = HostelFacility;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], HostelFacility.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: false }),
    (0, typeorm_1.Index)('idx_hostel_facilities_hostel_id'),
    __metadata("design:type", String)
], HostelFacility.prototype, "hostelId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => hostel_entity_1.Hostel, (hostel) => hostel.hostelFacilities, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'hostelId' }),
    __metadata("design:type", hostel_entity_1.Hostel)
], HostelFacility.prototype, "hostel", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: false }),
    (0, typeorm_1.Index)('idx_hostel_facilities_facility_id'),
    __metadata("design:type", String)
], HostelFacility.prototype, "facilityId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => facility_entity_1.Facility, (facility) => facility.hostelFacilities, {
        onDelete: 'RESTRICT',
        eager: false,
    }),
    (0, typeorm_1.JoinColumn)({ name: 'facilityId' }),
    __metadata("design:type", facility_entity_1.Facility)
], HostelFacility.prototype, "facility", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 500, nullable: true, default: null }),
    __metadata("design:type", Object)
], HostelFacility.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: facility_enum_1.FacilityTag, default: facility_enum_1.FacilityTag.INCLUDED }),
    (0, typeorm_1.Index)('idx_hostel_facilities_tag'),
    __metadata("design:type", String)
], HostelFacility.prototype, "tag", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 120, nullable: true, default: null }),
    __metadata("design:type", Object)
], HostelFacility.prototype, "clientKey", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], HostelFacility.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], HostelFacility.prototype, "updatedAt", void 0);
exports.HostelFacility = HostelFacility = __decorate([
    (0, typeorm_1.Entity)('hostel_facilities'),
    (0, typeorm_1.Index)('uq_hostel_facility', ['hostelId', 'facilityId'], { unique: true }),
    (0, typeorm_1.Index)('uq_hostel_facility_client_key', ['hostelId', 'clientKey'], {
        unique: true,
        where: '"clientKey" IS NOT NULL',
    })
], HostelFacility);
