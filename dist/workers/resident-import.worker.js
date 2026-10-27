"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResidentImportWorker = void 0;
const database_source_1 = require("../database/database-source");
const base_worker_1 = require("./base.worker");
const queue_constants_1 = require("../constant/queue.constants");
const roles_enum_1 = require("../enum/roles.enum");
const resident_import_entity_1 = require("../entities/import/resident-import.entity");
const user_entity_1 = require("../entities/user.entity");
const resident_entity_1 = require("../entities/resident/resident.entity");
const room_entity_1 = require("../entities/room/room.entity");
const hostel_entity_1 = require("../entities/hostel/hostel.entity");
const password_hasher_util_1 = require("../utils/password-hasher.util");
const normalize_util_1 = require("../utils/normalize.util");
const cache_util_1 = require("../utils/cache.util");
const brotli_util_1 = require("../utils/brotli.util");
const event_dispatcher_util_1 = require("../utils/event-dispatcher.util");
const socket_server_1 = require("../socket/socket.server");
const logger_1 = require("../observability/logger");
class ResidentImportWorker extends base_worker_1.BaseWorker {
    constructor() {
        super(queue_constants_1.QueueName.RESIDENT_IMPORT, 2);
    }
    async process(job) {
        if (job.name !== queue_constants_1.JobType.RESIDENT_CSV_IMPORT)
            return { skipped: true };
        // Jobs enqueued before Brotli carry plain `rows`; newer ones carry `rowsBr`.
        const { importId, hostelId, ownerId, rows } = (0, brotli_util_1.unpackQueueRows)(job.data);
        const importRepo = database_source_1.AppDataSource.getRepository(resident_import_entity_1.ResidentImport);
        const record = await importRepo.findOne({ where: { id: importId } });
        if (!record)
            throw new Error(`Resident import ${importId} not found`);
        if (record.status === resident_import_entity_1.ResidentImportStatus.COMPLETED)
            return { alreadyDone: true };
        record.status = resident_import_entity_1.ResidentImportStatus.PROCESSING;
        await importRepo.save(record);
        await this.emitProgress(hostelId, ownerId, record, 0);
        const errors = [
            ...(record.rowErrors ?? []),
        ];
        let success = 0;
        let failed = record.failedCount ?? 0;
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            try {
                await this.importSingleRow(hostelId, ownerId, row);
                success += 1;
            }
            catch (err) {
                failed += 1;
                errors.push({ row: row.line, email: row.email, message: errMsg(err) });
            }
            if ((i + 1) % 25 === 0 || i === rows.length - 1) {
                record.successCount = success;
                record.failedCount = failed;
                record.rowErrors = errors.slice(0, 100);
                await importRepo.save(record);
                await job.updateProgress(Math.round(((i + 1) / rows.length) * 100));
                await this.emitProgress(hostelId, ownerId, record, (i + 1) / rows.length);
            }
        }
        record.successCount = success;
        record.failedCount = failed;
        record.rowErrors = errors.slice(0, 100);
        record.completedAt = new Date();
        if (success === 0 && failed > 0)
            record.status = resident_import_entity_1.ResidentImportStatus.FAILED;
        else if (failed > 0)
            record.status = resident_import_entity_1.ResidentImportStatus.COMPLETED_WITH_ERRORS;
        else
            record.status = resident_import_entity_1.ResidentImportStatus.COMPLETED;
        if (record.status === resident_import_entity_1.ResidentImportStatus.FAILED && errors.length > 0) {
            record.failureReason = errors[0]?.message ?? 'Import failed';
        }
        await importRepo.save(record);
        await cache_util_1.cacheService.invalidatePattern('owner:resident-imports');
        await cache_util_1.cacheService.invalidatePattern('owner:residents');
        await cache_util_1.cacheService.invalidatePattern('hostel:residents');
        await cache_util_1.cacheService.invalidatePattern('owner:form-options');
        try {
            socket_server_1.socketServer.toHostel(hostelId, queue_constants_1.SocketEvent.RESIDENT_IMPORT_COMPLETED, {
                importId: record.id,
                status: record.status,
                successCount: success,
                failedCount: failed,
                totalRows: record.totalRows,
            });
        }
        catch {
            void 0;
        }
        await event_dispatcher_util_1.eventDispatcher
            .queueNotification({
            userId: ownerId,
            hostelId,
            title: 'Resident import finished',
            message: `${record.fileName}: ${success} created, ${failed} failed.`,
            type: 'RESIDENT_IMPORT_COMPLETED',
            data: { importId: record.id, status: record.status },
        })
            .catch(() => undefined);
        await event_dispatcher_util_1.eventDispatcher
            .dispatch({
            type: queue_constants_1.SocketEvent.USER_STATUS_CHANGED,
            payload: { importId: record.id, status: record.status },
            hostelId,
            metadata: { importId: record.id, success, failed },
        })
            .catch(() => undefined);
        logger_1.logger.info('Resident CSV import completed', { importId, success, failed });
        return { importId, success, failed };
    }
    async emitProgress(hostelId, ownerId, record, fraction) {
        try {
            socket_server_1.socketServer.toUser(ownerId, queue_constants_1.SocketEvent.RESIDENT_IMPORT_PROGRESS, {
                importId: record.id,
                hostelId,
                status: record.status,
                progress: Math.round(fraction * 100),
                successCount: record.successCount,
                failedCount: record.failedCount,
                totalRows: record.totalRows,
            });
        }
        catch {
            void 0;
        }
    }
    async importSingleRow(hostelId, ownerId, row) {
        const email = (0, normalize_util_1.normalizeEmail)(row.email);
        await database_source_1.AppDataSource.transaction(async (manager) => {
            const userRepo = manager.getRepository(user_entity_1.User);
            const residentRepo = manager.getRepository(resident_entity_1.Resident);
            const roomRepo = manager.getRepository(room_entity_1.Room);
            const hostelRepo = manager.getRepository(hostel_entity_1.Hostel);
            const hostel = await hostelRepo.findOne({ where: { id: hostelId } });
            if (!hostel)
                throw new Error(`Row ${row.line}: hostel not found`);
            if (hostel.ownerId !== null && hostel.ownerId !== ownerId) {
                const owned = await hostelRepo.findOne({ where: { id: hostelId, ownerId } });
                if (!owned)
                    throw new Error(`Row ${row.line}: no permission for hostel`);
            }
            const roomNo = row.room.trim();
            let room = await roomRepo.findOne({ where: { hostelId, roomNumber: roomNo } });
            if (!room) {
                room = await roomRepo.findOne({ where: { ownerId, roomNumber: roomNo } });
                if (room)
                    room.hostelId = hostelId;
            }
            if (!room)
                throw new Error(`Row ${row.line}: room ${roomNo} missing`);
            const st = String(room.status ?? 'AVAILABLE').toUpperCase();
            if (st === 'MAINTENANCE' || st === 'RESERVED') {
                throw new Error(`Row ${row.line}: room ${roomNo} is ${st.toLowerCase()}`);
            }
            const taken = await residentRepo.find({
                where: { hostelId, roomNumber: room.roomNumber, isActive: true },
                select: { bedNumber: true, roomNumber: true },
            });
            const takenBeds = taken.map((r) => (r.bedNumber ?? '').trim()).filter(Boolean);
            const occupied = Math.max(takenBeds.length, Number(room.occupied) || 0);
            const capacity = Number(room.capacity) || 0;
            if (occupied >= capacity)
                throw new Error(`Row ${row.line}: room ${roomNo} is full`);
            const bed = row.bed.trim();
            const bedTaken = takenBeds.some((b) => b.toLowerCase() === bed.toLowerCase());
            if (bedTaken)
                throw new Error(`Row ${row.line}: bed ${bed} taken`);
            let user = await userRepo.findOne({ where: { email } });
            const tempPassword = 'Hostel@123';
            if (!user) {
                const parts = row.name.trim().split(/\s+/);
                const firstName = parts.shift() ?? row.name.trim();
                const lastName = parts.join(' ') || firstName;
                user = userRepo.create({
                    firstName,
                    lastName,
                    email,
                    phone: row.phone,
                    password: await password_hasher_util_1.PasswordHasher.hash(tempPassword),
                    role: roles_enum_1.IROLES.RESIDENT,
                });
                user = await userRepo.save(user);
                await event_dispatcher_util_1.eventDispatcher
                    .queueEmail(queue_constants_1.JobType.SEND_WELCOME_EMAIL, {
                    to: user.email,
                    subject: `Welcome to ${hostel.name}`,
                    body: `Hello ${user.firstName}, added to ${hostel.name} room ${roomNo}. Temp password: ${tempPassword}`,
                })
                    .catch(() => undefined);
            }
            else {
                const dupe = await residentRepo.findOne({ where: { userId: user.id, isActive: true } });
                if (dupe)
                    throw new Error(`Row ${row.line}: ${email} already resident`);
            }
            let rent = row.rent;
            if ((rent === null || rent === undefined) && room.monthlyRent !== null) {
                rent = Number(room.monthlyRent);
            }
            const resident = residentRepo.create({
                userId: user.id,
                hostelId,
                roomNumber: room.roomNumber,
                bedNumber: bed,
                monthlyRent: rent,
                isActive: true,
            });
            await residentRepo.save(resident);
            const next = occupied + 1;
            room.occupied = next;
            if (next >= capacity && String(room.status) === 'AVAILABLE') {
                room.status = 'OCCUPIED';
            }
            await roomRepo.save(room);
        });
    }
}
exports.ResidentImportWorker = ResidentImportWorker;
function errMsg(err) {
    return err instanceof Error ? err.message : 'Row failed';
}
