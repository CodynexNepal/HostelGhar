import { LeaveRepository } from '../../repository/leave/leave.repository';
import { LeaveStatus } from '../../enum/leave.enum';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { eventDispatcher } from '../../utils/event-dispatcher.util';
import { SocketEvent } from '../../constant/queue.constants';
import { cacheService } from '../../utils/cache.util';
import { createPaginatedResponse } from '../../utils/pagination.util';

export class LeaveService {
  constructor(private readonly leaveRepository: LeaveRepository) {}

  public async listHostelLeaves(
    hostelId: string,
    status?: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const parsedStatus =
      status && Object.values(LeaveStatus).includes(status as LeaveStatus)
        ? (status as LeaveStatus)
        : undefined;

    const cacheKey = cacheService.generateKey('hostel:leaves', {
      hostelId,
      status: parsedStatus || 'ALL',
      page,
      limit,
    });

    // 3-Level Cache: L1 (LRU RAM) -> L2 (Redis) -> L3 (DB)
    const { data, isCached, cacheLevel } = await cacheService.wrap(
      cacheKey,
      async () => {
        const [leaves, total] = await this.leaveRepository.findByHostel(
          hostelId,
          parsedStatus,
          page,
          limit,
        );
        return { leaves, total };
      },
      { l1TtlSeconds: 30, l2TtlSeconds: 120 },
    );

    return createPaginatedResponse(
      data.leaves,
      data.total,
      { page, limit },
      { isCached, cacheLevel },
    );
  }

  public async updateLeaveStatus(leaveId: string, status: string, actorId: string) {
    if (!Object.values(LeaveStatus).includes(status as LeaveStatus)) {
      return { error: { status: STATUS_CODE.BAD_REQUEST, message: 'Invalid leave status' } };
    }

    const leave = await this.leaveRepository.findById(leaveId);
    if (!leave) {
      return { error: { status: STATUS_CODE.NOT_FOUND, message: 'Leave request not found' } };
    }

    leave.status = status as LeaveStatus;
    const savedLeave = await this.leaveRepository.save(leave);

    // Invalidate leave caches across tiers
    await cacheService.invalidatePattern(`hostel:leaves:${leave.resident.hostelId}`);
    await cacheService.invalidatePattern(`resident:leaves:${leave.residentId}`);

    await eventDispatcher.dispatch({
      type: SocketEvent.LEAVE_STATUS_CHANGED,
      payload: savedLeave,
      userId: leave.resident.userId,
      hostelId: leave.resident.hostelId,
      metadata: { actorId, leaveId },
    });

    return { data: savedLeave };
  }
}
