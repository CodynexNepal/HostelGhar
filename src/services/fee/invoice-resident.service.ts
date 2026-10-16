// ─────────────────────────────────────────────────────────────
// FILE: invoice-resident.service.ts
// PURPOSE: Resolve a hostel resident from a dashboard "Resident name" string.
// ─────────────────────────────────────────────────────────────

import { AppDataSource } from '../../database/database-source';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { Resident } from '../../entities/resident/resident.entity';
import { createHttpError } from '../../utils/createHttpError';

const fullNameOf = (resident: Resident): string =>
  `${resident.user?.firstName ?? ''} ${resident.user?.lastName ?? ''}`.trim();

export const findResidentByName = async (hostelId: string, name: string): Promise<Resident> => {
  const repo = AppDataSource.getRepository(Resident);
  const rows = await repo.find({
    where: { hostelId, isActive: true },
    relations: { user: true, hostel: true },
  });
  const needle = name.trim().toLowerCase();
  const exact = rows.filter((row) => fullNameOf(row).toLowerCase() === needle);
  const firstExact = exact[0];
  if (exact.length === 1 && firstExact) return firstExact;
  if (exact.length > 1) {
    throw createHttpError(
      STATUS_CODE.CONFLICT,
      `Multiple residents named "${name}" live in this hostel — please use residentId instead`,
    );
  }
  const partial = rows.filter((row) => fullNameOf(row).toLowerCase().includes(needle));
  const firstPartial = partial[0];
  if (partial.length === 1 && firstPartial) return firstPartial;
  if (partial.length > 1) {
    const options = partial.map((row) => fullNameOf(row)).join(', ');
    throw createHttpError(
      STATUS_CODE.CONFLICT,
      `Multiple residents match "${name}" (${options}) — please use residentId instead`,
    );
  }
  throw createHttpError(
    STATUS_CODE.NOT_FOUND,
    `No active resident named "${name}" found in this hostel`,
  );
};
