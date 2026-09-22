// FILE: resident-import.worker.ts (part 1: imports + class shell)
import { Job } from 'bullmq';
import { AppDataSource } from '../database/database-source';
import { BaseWorker } from './base.worker';
import { JobType, QueueName, SocketEvent } from '../constant/queue.constants';
import { IROLES } from '../enum/roles.enum';
import { ResidentImport, ResidentImportStatus } from '../entities/import/resident-import.entity';
import { User } from '../entities/user.entity';
import { Resident } from '../entities/resident/resident.entity';
import { Room } from '../entities/room/room.entity';
import { Hostel } from '../entities/hostel/hostel.entity';
import { PasswordHasher } from '../utils/password-hasher.util';
import { normalizeEmail } from '../utils/normalize.util';
import { cacheService } from '../utils/cache.util';
import { eventDispatcher } from '../utils/event-dispatcher.util';
import { socketServer } from '../socket/socket.server';
import { logger } from '../observability/logger';
import { ResidentImportJobPayload } from '../services/resident/resident-import.service';
export class ResidentImportWorker extends BaseWorker<ResidentImportJobPayload> {
  constructor() {
    super(QueueName.RESIDENT_IMPORT, 2);
  }

  async process(job: Job<ResidentImportJobPayload>): Promise<Record<string, unknown>> {
    if (job.name !== JobType.RESIDENT_CSV_IMPORT) return { skipped: true };
    const { importId, hostelId, ownerId, rows } = job.data;
    const importRepo = AppDataSource.getRepository(ResidentImport);
    const record = await importRepo.findOne({ where: { id: importId } });
    if (!record) throw new Error(`Resident import ${importId} not found`);
    if (record.status === ResidentImportStatus.COMPLETED) return { alreadyDone: true };
    record.status = ResidentImportStatus.PROCESSING;
    await importRepo.save(record);
    await this.emitProgress(hostelId, ownerId, record, 0);
    const errors: Array<{ row: number; email?: string | undefined; message: string }> = [
      ...(record.rowErrors ?? []),
    ];
    let success = 0;
    let failed = record.failedCount ?? 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as ResidentImportJobPayload['rows'][number];
      try {
        await this.importSingleRow(hostelId, ownerId, row);
        success += 1;
      } catch (err: unknown) {
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
    if (success === 0 && failed > 0) record.status = ResidentImportStatus.FAILED;
    else if (failed > 0) record.status = ResidentImportStatus.COMPLETED_WITH_ERRORS;
    else record.status = ResidentImportStatus.COMPLETED;
    if (record.status === ResidentImportStatus.FAILED && errors.length > 0) {
      record.failureReason = errors[0]?.message ?? 'Import failed';
    }
    await importRepo.save(record);
    await cacheService.invalidatePattern('owner:resident-imports');
    await cacheService.invalidatePattern('owner:residents');
    await cacheService.invalidatePattern('hostel:residents');
    await cacheService.invalidatePattern('owner:form-options');
    try {
      socketServer.toHostel(hostelId, SocketEvent.RESIDENT_IMPORT_COMPLETED, {
        importId: record.id,
        status: record.status,
        successCount: success,
        failedCount: failed,
        totalRows: record.totalRows,
      });
    } catch {
      void 0;
    }
    await eventDispatcher
      .queueNotification({
        userId: ownerId,
        hostelId,
        title: 'Resident import finished',
        message: `${record.fileName}: ${success} created, ${failed} failed.`,
        type: 'RESIDENT_IMPORT_COMPLETED',
        data: { importId: record.id, status: record.status },
      })
      .catch(() => undefined);
    await eventDispatcher
      .dispatch({
        type: SocketEvent.USER_STATUS_CHANGED,
        payload: { importId: record.id, status: record.status },
        hostelId,
        metadata: { importId: record.id, success, failed },
      })
      .catch(() => undefined);
    logger.info('Resident CSV import completed', { importId, success, failed });
    return { importId, success, failed };
  }
  private async emitProgress(
    hostelId: string,
    ownerId: string,
    record: ResidentImport,
    fraction: number,
  ): Promise<void> {
    try {
      socketServer.toUser(ownerId, SocketEvent.RESIDENT_IMPORT_PROGRESS, {
        importId: record.id,
        hostelId,
        status: record.status,
        progress: Math.round(fraction * 100),
        successCount: record.successCount,
        failedCount: record.failedCount,
        totalRows: record.totalRows,
      });
    } catch {
      void 0;
    }
  }
  private async importSingleRow(
    hostelId: string,
    ownerId: string,
    row: ResidentImportJobPayload['rows'][number],
  ): Promise<void> {
    const email = normalizeEmail(row.email);
    await AppDataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const residentRepo = manager.getRepository(Resident);
      const roomRepo = manager.getRepository(Room);
      const hostelRepo = manager.getRepository(Hostel);
      const hostel = await hostelRepo.findOne({ where: { id: hostelId } });
      if (!hostel) throw new Error(`Row ${row.line}: hostel not found`);
      if (hostel.ownerId !== null && hostel.ownerId !== ownerId) {
        const owned = await hostelRepo.findOne({ where: { id: hostelId, ownerId } });
        if (!owned) throw new Error(`Row ${row.line}: no permission for hostel`);
      }
      const roomNo = row.room.trim();
      let room = await roomRepo.findOne({ where: { hostelId, roomNumber: roomNo } });
      if (!room) {
        room = await roomRepo.findOne({ where: { ownerId, roomNumber: roomNo } });
        if (room) room.hostelId = hostelId;
      }
      if (!room) throw new Error(`Row ${row.line}: room ${roomNo} missing`);
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
      if (occupied >= capacity) throw new Error(`Row ${row.line}: room ${roomNo} is full`);
      const bed = row.bed.trim();
      const bedTaken = takenBeds.some((b) => b.toLowerCase() === bed.toLowerCase());
      if (bedTaken) throw new Error(`Row ${row.line}: bed ${bed} taken`);
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
          password: await PasswordHasher.hash(tempPassword),
          role: IROLES.RESIDENT,
        });
        user = await userRepo.save(user);
        await eventDispatcher
          .queueEmail(JobType.SEND_WELCOME_EMAIL, {
            to: user.email,
            subject: `Welcome to ${hostel.name}`,
            body: `Hello ${user.firstName}, added to ${hostel.name} room ${roomNo}. Temp password: ${tempPassword}`,
          })
          .catch(() => undefined);
      } else {
        const dupe = await residentRepo.findOne({ where: { userId: user.id, isActive: true } });
        if (dupe) throw new Error(`Row ${row.line}: ${email} already resident`);
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
        room.status = 'OCCUPIED' as Room['status'];
      }
      await roomRepo.save(room);
    });
  }
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : 'Row failed';
}
