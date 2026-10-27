"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: resident-import.entity.ts
// PURPOSE: Persists every bulk CSV resident-import as a background job record
//          so the "Import Residents" UI can render import history, progress,
//          per-row errors and plan-limit usage.
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
exports.ResidentImport = exports.ResidentImportStatus = void 0;
const typeorm_1 = require("typeorm");
const hostel_entity_1 = require("../hostel/hostel.entity");
const user_entity_1 = require("../user.entity");
var ResidentImportStatus;
(function (ResidentImportStatus) {
    ResidentImportStatus["QUEUED"] = "QUEUED";
    ResidentImportStatus["PROCESSING"] = "PROCESSING";
    ResidentImportStatus["COMPLETED"] = "COMPLETED";
    ResidentImportStatus["COMPLETED_WITH_ERRORS"] = "COMPLETED_WITH_ERRORS";
    ResidentImportStatus["FAILED"] = "FAILED";
})(ResidentImportStatus || (exports.ResidentImportStatus = ResidentImportStatus = {}));
let ResidentImport = class ResidentImport {
};
exports.ResidentImport = ResidentImport;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ResidentImport.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: false }),
    __metadata("design:type", String)
], ResidentImport.prototype, "hostelId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => hostel_entity_1.Hostel, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'hostelId' }),
    __metadata("design:type", hostel_entity_1.Hostel)
], ResidentImport.prototype, "hostel", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: false }),
    __metadata("design:type", String)
], ResidentImport.prototype, "requestedBy", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { onDelete: 'SET NULL', nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'requestedBy' }),
    __metadata("design:type", Object)
], ResidentImport.prototype, "requestedByUser", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: false }),
    __metadata("design:type", String)
], ResidentImport.prototype, "fileName", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ResidentImportStatus,
        default: ResidentImportStatus.QUEUED,
    }),
    __metadata("design:type", String)
], ResidentImport.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], ResidentImport.prototype, "totalRows", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], ResidentImport.prototype, "validRows", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], ResidentImport.prototype, "successCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], ResidentImport.prototype, "failedCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 64, nullable: true, default: null }),
    __metadata("design:type", Object)
], ResidentImport.prototype, "idempotencyKey", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true, default: null }),
    __metadata("design:type", Object)
], ResidentImport.prototype, "rowErrors", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true, default: null }),
    __metadata("design:type", Object)
], ResidentImport.prototype, "failureReason", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], ResidentImport.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], ResidentImport.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', nullable: true, default: null }),
    __metadata("design:type", Object)
], ResidentImport.prototype, "completedAt", void 0);
exports.ResidentImport = ResidentImport = __decorate([
    (0, typeorm_1.Entity)('resident_imports'),
    (0, typeorm_1.Index)('idx_resident_imports_hostel_created', ['hostelId', 'createdAt']),
    (0, typeorm_1.Index)('idx_resident_imports_owner_created', ['requestedBy', 'createdAt']),
    (0, typeorm_1.Index)('idx_resident_imports_status', ['status'])
], ResidentImport);
