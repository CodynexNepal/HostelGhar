"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: facility.dto.ts
// PURPOSE: Validation DTOs for hostel facility endpoints.
//          Frontend sends: { id?, title, description?, tag? }.
//          `id` is the FRONTEND client key (e.g. "security-mu5ofghs") —
//          mapped to HostelFacility.clientKey, never to a DB primary key.
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
exports.SyncHostelFacilitiesDto = exports.UpsertFacilityItemDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const facility_enum_1 = require("../../enum/facility.enum");
class UpsertFacilityItemDto {
}
exports.UpsertFacilityItemDto = UpsertFacilityItemDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], UpsertFacilityItemDto.prototype, "id", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'Facility title is required' }),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], UpsertFacilityItemDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], UpsertFacilityItemDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(facility_enum_1.FacilityTag, { message: 'Tag must be one of: Included, Excluded, Extra Charge' }),
    __metadata("design:type", String)
], UpsertFacilityItemDto.prototype, "tag", void 0);
class SyncHostelFacilitiesDto {
}
exports.SyncHostelFacilitiesDto = SyncHostelFacilitiesDto;
__decorate([
    (0, class_validator_1.IsArray)({ message: 'facilities must be an array' }),
    (0, class_validator_1.ArrayMaxSize)(200, { message: 'Cannot sync more than 200 facilities at once' }),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => UpsertFacilityItemDto),
    __metadata("design:type", Array)
], SyncHostelFacilitiesDto.prototype, "facilities", void 0);
