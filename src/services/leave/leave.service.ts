import { LeaveRepository } from '../../repository/leave/leave.repository';
import { LeaveStatus } from '../../enum/leave.enum';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { eventDispatcher } from '../../utils/event-dispatcher.util';
import { SocketEvent } from '../../constant/queue.constants';

export class LeaveService {
  constructor(private readonly leaveRepository: LeaveRepository) {}

  public async listHostelLeaves(hostelId: string, status?: string) {
    const parsedStatus =
      status && Object.values(LeaveStatus).includes(status as LeaveStatus)
        ? (status as LeaveStatus)
        : undefined;
    return { data: await this.leaveRepository.findByHostel(hostelId, parsedStatus) };
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
