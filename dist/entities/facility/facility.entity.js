"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: facility.entity.ts
// PURPOSE: Canonical facility catalog (1NF/2NF/3NF master table).
//          One row per REAL-WORLD facility (Wifi, Security, Meals...) — never
//          duplicated per hostel. Hostels link via hostel_facilities (M:N).
//          Frontend `id` like "security-mu5ofghs" is a CLIENT key -> clientKey
//          on the junction row, NOT the DB primary key.
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
exports.Facility = void 0;
const typeorm_1 = require("typeorm");
const hostel_facility_entity_1 = require("./hostel-facility.entity");
let Facility = class Facility {
};
exports.Facility = Facility;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Facility.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 120, nullable: false }),
    __metadata("design:type", String)
], Facility.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 140, nullable: false }),
    (0, typeorm_1.Index)('idx_facilities_slug'),
    __metadata("design:type", String)
], Facility.prototype, "slug", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => hostel_facility_entity_1.HostelFacility, (hf) => hf.facility),
    __metadata("design:type", Array)
], Facility.prototype, "hostelFacilities", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], Facility.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], Facility.prototype, "updatedAt", void 0);
exports.Facility = Facility = __decorate([
    (0, typeorm_1.Entity)('facilities'),
    (0, typeorm_1.Unique)('uq_facilities_slug', ['slug'])
], Facility);
