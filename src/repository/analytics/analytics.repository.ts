import { AppDataSource } from '../../database/database-source';
import { User } from '../../entities/user.entity';
import { Hostel } from '../../entities/hostel/hostel.entity';
import { Resident } from '../../entities/resident/resident.entity';
import { Booking } from '../../entities/booking/booking.entity';
import { Fee } from '../../entities/fee/fee.entity';
import { LeaveRequest } from '../../entities/leave/leave-request.entity';
import { FeeStatus } from '../../enum/fee.enum';
import { LeaveStatus } from '../../enum/leave.enum';
import { BookingStatus } from '../../enum/booking.enum';

export class AnalyticsRepository {
  public async getAdminSummary() {
    const userRepo = AppDataSource.getRepository(User);
    const hostelRepo = AppDataSource.getRepository(Hostel);
    const residentRepo = AppDataSource.getRepository(Resident);
    const bookingRepo = AppDataSource.getRepository(Booking);
    const feeRepo = AppDataSource.getRepository(Fee);
    const leaveRepo = AppDataSource.getRepository(LeaveRequest);

    const [users, hostels, activeResidents, pendingBookings, pendingLeaves, unpaidFees] =
      await Promise.all([
        userRepo.count(),
        hostelRepo.count(),
        residentRepo.count({ where: { isActive: true } }),
        bookingRepo.count({ where: { status: BookingStatus.PENDING } }),
        leaveRepo.count({ where: { status: LeaveStatus.PENDING } }),
        feeRepo.count({ where: { status: FeeStatus.PENDING } }),
      ]);

    const revenue = await feeRepo
      .createQueryBuilder('fee')
      .select('COALESCE(SUM(fee.paidAmount), 0)', 'paid')
      .addSelect('COALESCE(SUM(fee.totalPayable - fee.paidAmount), 0)', 'outstanding')
      .getRawOne<{ paid: string; outstanding: string }>();

    return {
      users,
      hostels,
      activeResidents,
      pendingBookings,
      pendingLeaves,
      unpaidFees,
      paidAmount: Number(revenue?.paid || 0),
      outstandingAmount: Number(revenue?.outstanding || 0),
    };
  }

  public async getOwnerSummary(ownerId: string) {
    const hostelIds = (
      await AppDataSource.getRepository(Hostel).find({
        where: { ownerId },
        select: { id: true },
      })
    ).map((hostel) => hostel.id);

    if (!hostelIds.length) {
      return {
        hostels: 0,
        activeResidents: 0,
        pendingBookings: 0,
        pendingLeaves: 0,
        outstandingAmount: 0,
      };
    }

    const residentCount = await AppDataSource.getRepository(Resident)
      .createQueryBuilder('resident')
      .where('resident.hostelId IN (:...hostelIds)', { hostelIds })
      .andWhere('resident.isActive = :isActive', { isActive: true })
      .getCount();

    const pendingBookings = await AppDataSource.getRepository(Booking)
      .createQueryBuilder('booking')
      .where('booking.hostelId IN (:...hostelIds)', { hostelIds })
      .andWhere('booking.status = :status', { status: BookingStatus.PENDING })
      .getCount();

    const pendingLeaves = await AppDataSource.getRepository(LeaveRequest)
      .createQueryBuilder('leave')
      .leftJoin('leave.resident', 'resident')
      .where('resident.hostelId IN (:...hostelIds)', { hostelIds })
      .andWhere('leave.status = :status', { status: LeaveStatus.PENDING })
      .getCount();

    const feeTotals = await AppDataSource.getRepository(Fee)
      .createQueryBuilder('fee')
      .select('COALESCE(SUM(fee.totalPayable - fee.paidAmount), 0)', 'outstanding')
      .where('fee.hostelId IN (:...hostelIds)', { hostelIds })
      .getRawOne<{ outstanding: string }>();

    return {
      hostels: hostelIds.length,
      activeResidents: residentCount,
      pendingBookings,
      pendingLeaves,
      outstandingAmount: Number(feeTotals?.outstanding || 0),
    };
  }
}
