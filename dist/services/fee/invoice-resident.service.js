"use strict";
// ─────────────────────────────────────────────────────────────
// FILE: invoice-resident.service.ts
// PURPOSE: Resolve a hostel resident from a dashboard "Resident name" string.
// ─────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.findResidentByName = void 0;
const database_source_1 = require("../../database/database-source");
const statusCode_interface_1 = require("../../constant/statusCode.interface");
const resident_entity_1 = require("../../entities/resident/resident.entity");
const createHttpError_1 = require("../../utils/createHttpError");
const fullNameOf = (resident) => `${resident.user?.firstName ?? ''} ${resident.user?.lastName ?? ''}`.trim();
const findResidentByName = async (hostelId, name) => {
    const repo = database_source_1.AppDataSource.getRepository(resident_entity_1.Resident);
    const rows = await repo.find({
        where: { hostelId, isActive: true },
        relations: { user: true, hostel: true },
    });
    const needle = name.trim().toLowerCase();
    const exact = rows.filter((row) => fullNameOf(row).toLowerCase() === needle);
    const firstExact = exact[0];
    if (exact.length === 1 && firstExact)
        return firstExact;
    if (exact.length > 1) {
        throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.CONFLICT, `Multiple residents named "${name}" live in this hostel — please use residentId instead`);
    }
    const partial = rows.filter((row) => fullNameOf(row).toLowerCase().includes(needle));
    const firstPartial = partial[0];
    if (partial.length === 1 && firstPartial)
        return firstPartial;
    if (partial.length > 1) {
        const options = partial.map((row) => fullNameOf(row)).join(', ');
        throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.CONFLICT, `Multiple residents match "${name}" (${options}) — please use residentId instead`);
    }
    throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.NOT_FOUND, `No active resident named "${name}" found in this hostel`);
};
exports.findResidentByName = findResidentByName;
