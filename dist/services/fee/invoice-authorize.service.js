"use strict";
// ─────────────────────────────────────────────────────────────
// FILE: invoice-authorize.service.ts
// PURPOSE: Hostel ownership check shared by invoice creation paths.
// ─────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorizeInvoiceHostel = void 0;
const database_source_1 = require("../../database/database-source");
const statusCode_interface_1 = require("../../constant/statusCode.interface");
const hostel_entity_1 = require("../../entities/hostel/hostel.entity");
const roles_enum_1 = require("../../enum/roles.enum");
const createHttpError_1 = require("../../utils/createHttpError");
const authorizeInvoiceHostel = async (actorId, role, hostelId) => {
    const hostel = await database_source_1.AppDataSource.getRepository(hostel_entity_1.Hostel).findOne({
        where: { id: hostelId },
        relations: { owner: true },
    });
    if (!hostel)
        throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.NOT_FOUND, 'Hostel not found');
    const isAdmin = role.toLowerCase() === roles_enum_1.IROLES.ADMIN.toLowerCase();
    if (!isAdmin && hostel.ownerId !== actorId) {
        throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.FORBIDDEN, 'You do not manage this hostel');
    }
    return hostel;
};
exports.authorizeInvoiceHostel = authorizeInvoiceHostel;
