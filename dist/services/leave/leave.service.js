"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeaveService = void 0;
const leave_enum_1 = require("../../enum/leave.enum");
const statusCode_interface_1 = require("../../constant/statusCode.interface");
const event_dispatcher_util_1 = require("../../utils/event-dispatcher.util");
const queue_constants_1 = require("../../constant/queue.constants");
const cache_util_1 = require("../../utils/cache.util");
const pagination_util_1 = require("../../utils/pagination.util");
class LeaveService {
    constructor(leaveRepository) {
        this.leaveRepository = leaveRepository;
    }
    async listHostelLeaves(hostelId, status, page = 1, limit = 20) {
        const parsedStatus = status && Object.values(leave_enum_1.LeaveStatus).includes(status)
            ? status
            : undefined;
        const cacheKey = cache_util_1.cacheService.generateKey('hostel:leaves', {
            hostelId,
            status: parsedStatus || 'ALL',
            page,
            limit,
        });
        // 3-Level Cache: L1 (LRU RAM) -> L2 (Redis) -> L3 (DB)
        const { data, isCached, cacheLevel } = await cache_util_1.cacheService.wrap(cacheKey, async () => {
            const [leaves, total] = await this.leaveRepository.findByHostel(hostelId, parsedStatus, page, limit);
            return { leaves, total };
        }, { l1TtlSeconds: 30, l2TtlSeconds: 120 });
        return (0, pagination_util_1.createPaginatedResponse)(data.leaves, data.total, { page, limit }, { isCached, cacheLevel });
    }
    async updateLeaveStatus(leaveId, status, actorId) {
        if (!Object.values(leave_enum_1.LeaveStatus).includes(status)) {
            return { error: { status: statusCode_interface_1.STATUS_CODE.BAD_REQUEST, message: 'Invalid leave status' } };
        }
        const leave = await this.leaveRepository.findById(leaveId);
        if (!leave) {
            return { error: { status: statusCode_interface_1.STATUS_CODE.NOT_FOUND, message: 'Leave request not found' } };
        }
        leave.status = status;
        const savedLeave = await this.leaveRepository.save(leave);
        // Invalidate leave caches across tiers
        await cache_util_1.cacheService.invalidatePattern(`hostel:leaves:${leave.resident.hostelId}`);
        await cache_util_1.cacheService.invalidatePattern(`resident:leaves:${leave.residentId}`);
        await event_dispatcher_util_1.eventDispatcher.dispatch({
            type: queue_constants_1.SocketEvent.LEAVE_STATUS_CHANGED,
            payload: savedLeave,
            userId: leave.resident.userId,
            hostelId: leave.resident.hostelId,
            metadata: { actorId, leaveId },
        });
        return { data: savedLeave };
    }
}
exports.LeaveService = LeaveService;
