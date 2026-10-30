import { describe, expect, it, vi } from 'vitest';
import { OwnerController } from '../../src/controller/owner/owner.controller';
import { STATUS_CODE } from '../../src/constant/statusCode.interface';
import { FeeStatus } from '../../src/enum/fee.enum';
import { IROLES } from '../../src/enum/roles.enum';

vi.mock('../../src/utils/cache.util', () => ({
  cacheService: {
    generateKey: vi.fn().mockReturnValue('mock-key'),
    wrap: vi
      .fn()
      .mockImplementation((_k, fn) =>
        fn().then((data: any) => ({ data, isCached: false, cacheLevel: 'L3' })),
      ),
    invalidatePattern: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('../../src/utils/event-dispatcher.util', () => ({
  eventDispatcher: {
    dispatch: vi.fn().mockResolvedValue(undefined),
    queueEmail: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../src/services/notification/notification.service', () => ({
  notificationService: {
    createNotification: vi.fn().mockResolvedValue({}),
  },
}));

describe('Owner Resident Management (PaymentStatus, Update, Delete)', () => {
  describe('GET /owner/residents', () => {
    it('returns paymentStatus, feeStatus, and fee object for each resident', async () => {
      const mockResident = {
        id: 'res-1',
        hostelId: 'hostel-1',
        roomNumber: '101',
        bedNumber: 'B1',
        monthlyRent: 10000,
        createdAt: new Date(),
        user: {
          firstName: 'Ram',
          lastName: 'Thapa',
          email: 'ram@example.com',
          phone: '9841000000',
        },
        hostel: {
          id: 'hostel-1',
          name: 'Sunrise Hostel',
          type: 'BOYS',
          city: 'Kathmandu',
          address: 'Thamel',
        },
      };

      const mockFee = {
        id: 'fee-1',
        residentId: 'res-1',
        billingMonth: 10,
        billingYear: 2026,
        amount: 10000,
        dueAmount: 0,
        totalPayable: 10000,
        paidAmount: 10000,
        dueDate: '2026-10-30',
        status: FeeStatus.PAID,
      };

      const mockRepo = {
        findResidentsByOwner: vi.fn().mockResolvedValue([[mockResident], 1]),
        findRoomsForResidents: vi
          .fn()
          .mockResolvedValue(new Map([['hostel-1::101', { floor: 1, type: 'SINGLE' }]])),
        findLatestFeesForResidents: vi.fn().mockResolvedValue(new Map([['res-1', mockFee]])),
      } as any;

      const controller = new OwnerController(mockRepo);

      const req: any = {
        user: { userId: 'owner-1', role: IROLES.OWNER },
        query: { page: '1', limit: '20' },
      };

      const jsonMock = vi.fn();
      const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
      const res: any = { status: statusMock };
      const next = vi.fn();

      await controller.getResidents(req, res, next);

      expect(statusMock).toHaveBeenCalledWith(STATUS_CODE.OK);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: [
            expect.objectContaining({
              id: 'res-1',
              fullName: 'Ram Thapa',
              paymentStatus: FeeStatus.PAID,
              feeStatus: FeeStatus.PAID,
              fee: expect.objectContaining({
                amount: 10000,
                status: FeeStatus.PAID,
              }),
            }),
          ],
        }),
      );
    });
  });

  describe('PUT /owner/residents/:id', () => {
    it('updates resident details, user info, and rent successfully', async () => {
      const mockResident = {
        id: 'res-1',
        userId: 'user-1',
        hostelId: 'hostel-1',
        roomNumber: '101',
        bedNumber: 'B1',
        monthlyRent: 10000,
        isActive: true,
        user: {
          id: 'user-1',
          firstName: 'Ram',
          lastName: 'Thapa',
          email: 'ram@example.com',
          phone: '9841000000',
        },
      };

      const mockRepo = {
        findResidentById: vi.fn().mockResolvedValue(mockResident),
        findHostelByIdAndOwner: vi.fn().mockResolvedValue({ id: 'hostel-1', ownerId: 'owner-1' }),
        saveUser: vi.fn().mockImplementation((u) => Promise.resolve(u)),
        saveResident: vi.fn().mockImplementation((r) => Promise.resolve(r)),
      } as any;

      const controller = new OwnerController(mockRepo);

      const req: any = {
        params: { id: 'res-1' },
        user: { userId: 'owner-1', role: IROLES.OWNER },
        body: {
          name: 'Ram Bahadur Thapa',
          phone: '9841999999',
          monthlyRent: 12000,
        },
      };

      const jsonMock = vi.fn();
      const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
      const res: any = { status: statusMock };
      const next = vi.fn();

      await controller.updateResident(req, res, next);

      expect(statusMock).toHaveBeenCalledWith(STATUS_CODE.OK);
      expect(mockResident.user.firstName).toBe('Ram');
      expect(mockResident.user.lastName).toBe('Bahadur Thapa');
      expect(mockResident.user.phone).toBe('9841999999');
      expect(mockResident.monthlyRent).toBe(12000);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Resident updated successfully',
        }),
      );
    });
  });

  describe('DELETE /owner/residents/:id', () => {
    it('deletes resident and frees room bed capacity', async () => {
      const mockResident = {
        id: 'res-1',
        hostelId: 'hostel-1',
        roomNumber: '101',
      };

      const mockRoom = {
        id: 'room-1',
        hostelId: 'hostel-1',
        roomNumber: '101',
        occupied: 2,
        capacity: 2,
        status: 'OCCUPIED',
      };

      const mockRepo = {
        findResidentById: vi.fn().mockResolvedValue(mockResident),
        findHostelByIdAndOwner: vi.fn().mockResolvedValue({ id: 'hostel-1', ownerId: 'owner-1' }),
        findRoomByHostelAndNumber: vi.fn().mockResolvedValue(mockRoom),
        saveRoom: vi.fn().mockImplementation((r) => Promise.resolve(r)),
        deleteResident: vi.fn().mockResolvedValue(undefined),
      } as any;

      const controller = new OwnerController(mockRepo);

      const req: any = {
        params: { id: 'res-1' },
        user: { userId: 'owner-1', role: IROLES.OWNER },
      };

      const jsonMock = vi.fn();
      const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
      const res: any = { status: statusMock };
      const next = vi.fn();

      await controller.deleteResident(req, res, next);

      expect(mockRoom.occupied).toBe(1);
      expect(mockRoom.status).toBe('AVAILABLE');
      expect(mockRepo.deleteResident).toHaveBeenCalledWith('res-1');
      expect(statusMock).toHaveBeenCalledWith(STATUS_CODE.OK);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        message: 'Resident deleted successfully',
      });
    });
  });
});
