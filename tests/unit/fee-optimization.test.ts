import { describe, expect, it, vi, beforeEach } from 'vitest';
import { FeeService } from '../../src/services/fee/fee.service';
import { FeeRepository } from '../../src/repository/fee/fee.repository';
import { FeeController } from '../../src/controller/fee/fee.controller';
import { eventDispatcher } from '../../src/utils/event-dispatcher.util';
import { cacheService } from '../../src/utils/cache.util';
import { systemEventQueue } from '../../src/queue/queue.factory';
import { STATUS_CODE } from '../../src/constant/statusCode.interface';
import { Request, Response } from 'express';

describe('FeeService and FeeController Optimization & Scalability', () => {
  let feeService: FeeService;
  let feeController: FeeController;
  let mockFeeRepo: Partial<FeeRepository>;

  beforeEach(() => {
    vi.restoreAllMocks();

    mockFeeRepo = {
      findActiveResidents: vi.fn(),
      findExistingMonthlyFees: vi.fn(),
      findPendingBalancesByResidents: vi.fn(),
      createFeesBulk: vi.fn(),
    };

    feeService = new FeeService(mockFeeRepo as FeeRepository);
    feeController = new FeeController(feeService);
  });

  it('generates fees for active unbilled residents in batch with 4 total queries', async () => {
    const residents = [
      {
        id: 'res-1',
        hostelId: 'hostel-1',
        userId: 'user-1',
        roomNumber: '101',
        user: { email: 'res1@hostel.com', firstName: 'Res', lastName: 'One' },
        hostel: {
          name: 'Hostel A',
          address: 'Kathmandu',
          phone: '9800000000',
          email: 'a@hostel.com',
          owner: { firstName: 'Owner', lastName: 'A' },
        },
      },
      {
        id: 'res-2',
        hostelId: 'hostel-1',
        userId: 'user-2',
        roomNumber: '102',
        user: { email: 'res2@hostel.com', firstName: 'Res', lastName: 'Two' },
        hostel: {
          name: 'Hostel A',
          address: 'Kathmandu',
          phone: '9800000000',
          email: 'a@hostel.com',
          owner: { firstName: 'Owner', lastName: 'A' },
        },
      },
    ];

    (mockFeeRepo.findActiveResidents as any).mockResolvedValue(residents);
    // Neither has been billed yet
    (mockFeeRepo.findExistingMonthlyFees as any).mockResolvedValue([]);
    // Balances
    const balances = new Map<string, number>([
      ['res-1', 500],
      ['res-2', 0],
    ]);
    (mockFeeRepo.findPendingBalancesByResidents as any).mockResolvedValue(balances);
    (mockFeeRepo.createFeesBulk as any).mockResolvedValue([
      { id: 'fee-1', residentId: 'res-1' },
      { id: 'fee-2', residentId: 'res-2' },
    ]);

    const cacheSpy = vi.spyOn(cacheService, 'invalidatePattern').mockResolvedValue(undefined);
    const bulkEmailSpy = vi.spyOn(eventDispatcher, 'queueEmailsBulk').mockResolvedValue([] as any);

    const result = await feeService.generateMonthlyFeesForAllHostels(10, 2026, 10500, {
      enforceNepaliFirstDay: false,
    });

    expect(result.generatedCount).toBe(2);
    expect(result.errors).toBe(0);

    // Verify batch methods called instead of N individual queries
    expect(mockFeeRepo.findActiveResidents).toHaveBeenCalledTimes(1);
    expect(mockFeeRepo.findExistingMonthlyFees).toHaveBeenCalledTimes(1);
    expect(mockFeeRepo.findPendingBalancesByResidents).toHaveBeenCalledTimes(1);
    expect(mockFeeRepo.createFeesBulk).toHaveBeenCalledTimes(1);

    // Verify cache invalidations happened once outside loop (5 patterns)
    expect(cacheSpy).toHaveBeenCalledTimes(5);

    // Verify bulk email dispatch
    expect(bulkEmailSpy).toHaveBeenCalledTimes(1);
    const queuedJobs = (bulkEmailSpy as any).mock.calls[0][0];
    expect(queuedJobs).toHaveLength(2);
  });

  it('is completely idempotent when all active residents are already billed', async () => {
    const residents = [
      {
        id: 'res-1',
        hostelId: 'hostel-1',
        userId: 'user-1',
        roomNumber: '101',
        user: { email: 'res1@hostel.com', firstName: 'Res', lastName: 'One' },
        hostel: { name: 'Hostel A' },
      },
    ];

    (mockFeeRepo.findActiveResidents as any).mockResolvedValue(residents);
    (mockFeeRepo.findExistingMonthlyFees as any).mockResolvedValue([{ residentId: 'res-1' }]);

    const result = await feeService.generateMonthlyFeesForAllHostels(10, 2026, 10500, {
      enforceNepaliFirstDay: false,
    });

    expect(result.generatedCount).toBe(0);
    expect(result.errors).toBe(0);
    expect(mockFeeRepo.createFeesBulk).not.toHaveBeenCalled();
    expect(mockFeeRepo.findPendingBalancesByResidents).not.toHaveBeenCalled();
  });

  it('supports asynchronous fee generation returning HTTP 202 with jobId and statusUrl', async () => {
    const req = {
      query: { async: 'true' },
      body: { billingMonth: 10, billingYear: 2026 },
      user: { userId: 'admin-1' },
    } as unknown as Request;

    let responseStatus = 0;
    let responseBody: any = null;
    const res = {
      status: (code: number) => {
        responseStatus = code;
        return {
          json: (body: any) => {
            responseBody = body;
          },
        };
      },
    } as unknown as Response;

    const queueAddSpy = vi
      .spyOn(systemEventQueue, 'add')
      .mockResolvedValue({ id: 'job-monthly-99' } as any);

    await feeController.generateMonthlyFees(req, res, () => {});

    expect(responseStatus).toBe(STATUS_CODE.ACCEPTED);
    expect(responseBody).toMatchObject({
      success: true,
      statusCode: 202,
      jobId: 'job-monthly-99',
      statusUrl: '/api/v1/hostel-ghar/fees/jobs/job-monthly-99',
    });
    expect(queueAddSpy).toHaveBeenCalledTimes(1);
  });

  it('returns job status and completion result via GET /fees/jobs/:jobId', async () => {
    const req = {
      params: { jobId: 'job-monthly-99' },
    } as unknown as Request;

    let responseStatus = 0;
    let responseBody: any = null;
    const res = {
      status: (code: number) => {
        responseStatus = code;
        return {
          json: (body: any) => {
            responseBody = body;
          },
        };
      },
    } as unknown as Response;

    vi.spyOn(systemEventQueue, 'getJob').mockResolvedValue({
      id: 'job-monthly-99',
      getState: async () => 'completed',
      progress: 100,
      returnvalue: { generatedCount: 45, errors: 0, nepaliMonth: 'Kartik 2083' },
      failedReason: null,
    } as any);

    await feeController.getJobStatus(req, res, () => {});

    expect(responseStatus).toBe(STATUS_CODE.OK);
    expect(responseBody).toMatchObject({
      success: true,
      data: {
        jobId: 'job-monthly-99',
        state: 'completed',
        progress: 100,
        result: { generatedCount: 45, errors: 0, nepaliMonth: 'Kartik 2083' },
      },
    });
  });
});
