// ─────────────────────────────────────────────────────────────
// FILE: invoice-authorize.service.ts
// PURPOSE: Hostel ownership check shared by invoice creation paths.
// ─────────────────────────────────────────────────────────────

import { AppDataSource } from '../../database/database-source';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { Hostel } from '../../entities/hostel/hostel.entity';
import { IROLES } from '../../enum/roles.enum';
import { createHttpError } from '../../utils/createHttpError';

export const authorizeInvoiceHostel = async (
  actorId: string,
  role: string,
  hostelId: string,
): Promise<Hostel> => {
  const hostel = await AppDataSource.getRepository(Hostel).findOne({
    where: { id: hostelId },
    relations: { owner: true },
  });
  if (!hostel) throw createHttpError(STATUS_CODE.NOT_FOUND, 'Hostel not found');
  const isAdmin = role.toLowerCase() === IROLES.ADMIN.toLowerCase();
  if (!isAdmin && hostel.ownerId !== actorId) {
    throw createHttpError(STATUS_CODE.FORBIDDEN, 'You do not manage this hostel');
  }
  return hostel;
};
