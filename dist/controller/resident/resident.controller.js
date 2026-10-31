"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: resident.controller.ts
// PURPOSE: Resident controller handling leave applications, leave histories,
//          fee queries, with 3-tier caching, real-time updates, and Cloudinary upload.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.residentController = exports.ResidentController = void 0;
const statusCode_interface_1 = require("../../constant/statusCode.interface");
const cache_util_1 = require("../../utils/cache.util");
const leave_enum_1 = require("../../enum/leave.enum");
const queue_constants_1 = require("../../constant/queue.constants");
const resident_repository_1 = require("../../repository/resident/resident.repository");
const pagination_util_1 = require("../../utils/pagination.util");
const image_upload_service_1 = require("../../services/upload/image-upload.service");
const createHttpError_1 = require("../../utils/createHttpError");
const payment_qr_service_1 = require("../../services/payment-qr/payment-qr.service");
const fee_enum_1 = require("../../enum/fee.enum");
const fee_credit_util_1 = require("../../utils/fee-credit.util");
class ResidentController {
    constructor(residentRepository) {
        this.residentRepository = residentRepository;
        /**
         * Resident applies for a leave
         */
        this.applyForLeave = async (req, res, next) => {
            try {
                const userId = req.user.userId;
                const dto = req.body;
                // Accept BOTH frontend namings: startDate/endDate/reason (canonical)
                // and fromDate/toDate/remarks (legacy UI). Canonical wins if both sent.
                const startDate = dto.startDate?.trim() || dto.fromDate?.trim() || '';
                const endDate = dto.endDate?.trim() || dto.toDate?.trim() || '';
                const reason = dto.reason?.trim() || dto.remarks?.trim() || null;
                if (!startDate || !endDate) {
                    res.status(statusCode_interface_1.STATUS_CODE.BAD_REQUEST).json({
                        success: false,
                        message: 'Start date and end date are required. Send { startDate, endDate } or { fromDate, toDate } as YYYY-MM-DD.',
                    });
                    return;
                }
                // Strict YYYY-MM-DD (not full ISO datetime) to match `date` columns.
                const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
                if (!DATE_ONLY.test(startDate) || !DATE_ONLY.test(endDate)) {
                    res.status(statusCode_interface_1.STATUS_CODE.BAD_REQUEST).json({
                        success: false,
                        message: 'Start date and end date must be valid ISO date strings (YYYY-MM-DD).',
                    });
                    return;
                }
                if (endDate < startDate) {
                    res.status(statusCode_interface_1.STATUS_CODE.BAD_REQUEST).json({
                        success: false,
                        message: 'End date must be on or after start date.',
                    });
                    return;
                }
                const resident = await this.residentRepository.findResidentByUserId(userId);
                if (!resident) {
                    res.status(statusCode_interface_1.STATUS_CODE.NOT_FOUND).json({
                        success: false,
                        message: 'Active resident record not found for your account',
                    });
                    return;
                }
                // Leave type must exist AND belong to the resident's own hostel.
                const leaveType = await this.residentRepository.findLeaveTypeById(dto.leaveTypeId);
                if (!leaveType || leaveType.hostelId !== resident.hostelId) {
                    res.status(statusCode_interface_1.STATUS_CODE.BAD_REQUEST).json({
                        success: false,
                        message: 'Invalid leave type for your hostel. Pick leaveTypeId from GET /hostels/:id/leave-types using your own hostelId.',
                    });
                    return;
                }
                const savedLeave = await this.residentRepository.createLeaveRequest({
                    residentId: resident.id,
                    leaveTypeId: dto.leaveTypeId,
                    startDate,
                    endDate,
                    reason,
                    status: leave_enum_1.LeaveStatus.PENDING,
                });
                // Invalidate resident's leave cache across all cache tiers
                await cache_util_1.cacheService.invalidatePattern(`resident:leaves:${resident.id}`);
                await cache_util_1.cacheService.invalidatePattern(`hostel:leaves:${resident.hostelId}`);
                // Emit live real-time notification to hostel owner and room
                req.notifyHostel(resident.hostelId, queue_constants_1.SocketEvent.LEAVE_STATUS_CHANGED, {
                    leaveId: savedLeave.id,
                    residentId: resident.id,
                    status: leave_enum_1.LeaveStatus.PENDING,
                    startDate,
                    endDate,
                });
                res.status(statusCode_interface_1.STATUS_CODE.CREATED).json({
                    success: true,
                    message: 'Leave application submitted successfully',
                    data: savedLeave,
                });
            }
            catch (error) {
                next(error);
            }
        };
        /**
         * GET /resident/me — dashboard bootstrap for the logged-in resident.
         * Returns resident profile + hostel + assigned room (matched by
         * hostelId+roomNumber) + roommates count, so the frontend NEVER calls
         * owner/admin-only routes like GET /hostels/:id/residents or GET /rooms.
         */
        this.getMyProfile = async (req, res, next) => {
            try {
                const userId = req.user.userId;
                const resident = await this.residentRepository.findResidentByUserId(userId);
                if (!resident) {
                    res
                        .status(statusCode_interface_1.STATUS_CODE.NOT_FOUND)
                        .json({ success: false, message: 'Resident profile not found' });
                    return;
                }
                const cacheKey = cache_util_1.cacheService.generateKey('resident:profile', resident.id);
                const { data, isCached, cacheLevel } = await cache_util_1.cacheService.wrap(cacheKey, async () => {
                    const room = await this.residentRepository.findRoomForResident(resident.hostelId, resident.roomNumber);
                    const facilities = await this.residentRepository.findFacilitiesByHostel(resident.hostelId);
                    return {
                        room: room
                            ? {
                                id: room.id,
                                roomNumber: room.roomNumber,
                                type: room.type,
                                capacity: room.capacity,
                                occupied: room.occupied,
                                monthlyRent: Number(room.monthlyRent),
                                floor: room.floor,
                                flat: room.floor,
                                status: room.status,
                                amenities: room.amenities ?? [],
                                imageUrl: room.imageUrl,
                            }
                            : null,
                        facilities: facilities.map((hf) => ({
                            id: hf.id,
                            title: hf.facility?.title ?? null,
                            slug: hf.facility?.slug ?? null,
                            description: hf.description,
                            tag: hf.tag,
                        })),
                    };
                }, { l1TtlSeconds: 30, l2TtlSeconds: 120 });
                const firstName = resident.user?.firstName ?? '';
                const lastName = resident.user?.lastName ?? '';
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    isCached,
                    cacheLevel,
                    data: {
                        id: resident.id,
                        fullName: `${firstName} ${lastName}`.trim(),
                        firstName,
                        lastName,
                        email: resident.user?.email ?? null,
                        phone: resident.user?.phone ?? null,
                        photoUrl: resident.photoUrl ?? resident.user?.avatarUrl ?? null,
                        roomNumber: resident.roomNumber ?? null,
                        bedNumber: resident.bedNumber ?? null,
                        monthlyRent: resident.monthlyRent != null ? Number(resident.monthlyRent) : null,
                        joinedDate: resident.createdAt ?? null,
                        hostel: resident.hostel
                            ? {
                                id: resident.hostel.id,
                                name: resident.hostel.name,
                                type: resident.hostel.type ?? null,
                                city: resident.hostel.city ?? null,
                                address: resident.hostel.address ?? null,
                            }
                            : { id: resident.hostelId, name: null, type: null, city: null, address: null },
                        room: data.room,
                        facilities: data.facilities,
                    },
                });
            }
            catch (error) {
                next(error);
            }
        };
        /**
         * Get resident's leave history with 3-tier caching & pagination
         */
        this.getMyLeaves = async (req, res, next) => {
            try {
                const userId = req.user.userId;
                const { page, limit } = (0, pagination_util_1.normalizePagination)({
                    page: req.query.page,
                    limit: req.query.limit,
                });
                const resident = await this.residentRepository.findResidentByUserId(userId);
                if (!resident) {
                    res
                        .status(statusCode_interface_1.STATUS_CODE.NOT_FOUND)
                        .json({ success: false, message: 'Resident profile not found' });
                    return;
                }
                const cacheKey = cache_util_1.cacheService.generateKey('resident:leaves', {
                    residentId: resident.id,
                    page,
                    limit,
                });
                // 3-tier cache: L1 Memory LRU -> L2 Redis -> L3 DB
                const { data, isCached, cacheLevel } = await cache_util_1.cacheService.wrap(cacheKey, async () => {
                    const [leaves, total] = await this.residentRepository.findLeavesByResident(resident.id, page, limit);
                    return { leaves, total };
                }, { l1TtlSeconds: 30, l2TtlSeconds: 120 });
                const paginated = (0, pagination_util_1.createPaginatedResponse)(data.leaves, data.total, { page, limit }, { isCached, cacheLevel });
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    ...paginated,
                });
            }
            catch (error) {
                next(error);
            }
        };
        /**
         * Get resident fee bills and dues with 3-tier caching
         */
        this.getMyFees = async (req, res, next) => {
            try {
                const userId = req.user.userId;
                const resident = await this.residentRepository.findResidentByUserId(userId);
                if (!resident) {
                    res
                        .status(statusCode_interface_1.STATUS_CODE.NOT_FOUND)
                        .json({ success: false, message: 'Resident profile not found' });
                    return;
                }
                const cacheKey = cache_util_1.cacheService.generateKey('resident:fees', resident.id);
                const { data, isCached, cacheLevel } = await cache_util_1.cacheService.wrap(cacheKey, async () => {
                    const fees = await this.residentRepository.findFeesByResident(resident.id);
                    // Dues are AMOUNT-driven, not label-driven: a bill whose paidAmount
                    // covers totalPayable is PAID (even if an earlier approval stamped it
                    // PARTIALLY_PAID), and a bill stamped PAID with a short paidAmount
                    // still reports its real outstanding instead of inflating "Current dues".
                    const ledger = fees.map((fee) => {
                        const totalPayable = Number(fee.totalPayable);
                        const paidAmount = Number(fee.paidAmount);
                        const discountAmount = Number(fee.discountAmount ?? 0);
                        const outstanding = (0, fee_credit_util_1.feeOutstandingAmount)({ totalPayable, paidAmount, discountAmount });
                        const status = (0, fee_credit_util_1.calculatePaymentStatus)(fee);
                        return {
                            ...fee,
                            totalPayable,
                            discountAmount,
                            paidAmount,
                            outstanding,
                            outstandingAmount: outstanding,
                            status,
                            isPaid: status === fee_enum_1.FeeStatus.PAID,
                        };
                    });
                    const totalPendingDue = ledger.reduce((sum, fee) => sum + fee.outstanding, 0);
                    const totalOverdue = ledger
                        .filter((fee) => fee.status === fee_enum_1.FeeStatus.OVERDUE)
                        .reduce((sum, fee) => sum + fee.outstanding, 0);
                    const totalPaid = ledger.reduce((sum, fee) => sum + fee.paidAmount, 0);
                    return { fees: ledger, totalPendingDue, totalOverdue, totalPaid };
                }, { l1TtlSeconds: 30, l2TtlSeconds: 120 });
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    isCached,
                    cacheLevel,
                    ...data,
                });
            }
            catch (error) {
                next(error);
            }
        };
        /**
         * Upload or update own student profile photo (with face centering)
         */
        this.uploadMyPhoto = async (req, res, next) => {
            try {
                const userId = req.user.userId;
                const resident = await this.residentRepository.findResidentByUserId(userId);
                if (!resident) {
                    throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.NOT_FOUND, 'Resident profile not found');
                }
                if (!req.file) {
                    throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.BAD_REQUEST, 'Photo file is required in field "photo"');
                }
                const uploadResult = await image_upload_service_1.imageUploadService.uploadStudentPhoto(req.file, resident.id, resident.photoPublicId);
                resident.photoUrl = uploadResult.url;
                resident.photoPublicId = uploadResult.publicId;
                const savedResident = await this.residentRepository.saveResident(resident);
                await cache_util_1.cacheService.invalidatePattern(`hostel:residents`);
                await cache_util_1.cacheService.invalidatePattern(`owner:residents`);
                await cache_util_1.cacheService.invalidatePattern(`resident:profile`);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    message: 'Student profile photo uploaded successfully',
                    data: savedResident,
                });
            }
            catch (error) {
                next(error);
            }
        };
        /**
         * Upload or update own identification document
         */
        this.uploadMyDocument = async (req, res, next) => {
            try {
                const userId = req.user.userId;
                const resident = await this.residentRepository.findResidentByUserId(userId);
                if (!resident) {
                    throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.NOT_FOUND, 'Resident profile not found');
                }
                if (!req.file) {
                    throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.BAD_REQUEST, 'Document file is required in field "document"');
                }
                const uploadResult = await image_upload_service_1.imageUploadService.uploadStudentDocument(req.file, resident.id, resident.documentPublicId);
                resident.documentUrl = uploadResult.url;
                resident.documentPublicId = uploadResult.publicId;
                const savedResident = await this.residentRepository.saveResident(resident);
                await cache_util_1.cacheService.invalidatePattern(`hostel:residents`);
                await cache_util_1.cacheService.invalidatePattern(`owner:residents`);
                await cache_util_1.cacheService.invalidatePattern(`resident:profile`);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    message: 'Student document uploaded successfully',
                    data: savedResident,
                });
            }
            catch (error) {
                next(error);
            }
        };
        /**
         * Get active Payment QR codes for resident's hostel (under "My Payments")
         */
        this.getMyPaymentQrs = async (req, res, next) => {
            try {
                const userId = req.user.userId;
                const paymentQrService = new payment_qr_service_1.PaymentQrService();
                const result = await paymentQrService.getResidentPaymentQrs(userId);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    data: result,
                });
            }
            catch (error) {
                next(error);
            }
        };
    }
}
exports.ResidentController = ResidentController;
exports.residentController = new ResidentController(new resident_repository_1.ResidentRepository());
