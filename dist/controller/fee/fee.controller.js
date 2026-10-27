"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeeController = void 0;
const statusCode_interface_1 = require("../../constant/statusCode.interface");
const http_decorator_1 = require("../../decorators/http.decorator");
const pagination_util_1 = require("../../utils/pagination.util");
const fee_enum_1 = require("../../enum/fee.enum");
const queue_factory_1 = require("../../queue/queue.factory");
const fee_scheduler_job_1 = require("../../jobs/fee-scheduler.job");
const nepali_date_util_1 = require("../../utils/nepali-date.util");
class FeeController {
    constructor(feeService) {
        this.feeService = feeService;
        this.generateMonthlyFees = async (req, res, next) => {
            try {
                const isAsync = req.query.async === 'true' || req.body?.async === true;
                if (isAsync) {
                    const job = await queue_factory_1.systemEventQueue.add(fee_scheduler_job_1.TRIGGER_MONTHLY_FEES_JOB, {
                        requestedBy: req.user?.userId,
                        billingMonth: req.body?.billingMonth,
                        billingYear: req.body?.billingYear,
                        baseFee: req.body?.baseFee,
                    }, {
                        removeOnComplete: 100,
                        removeOnFail: 500,
                    });
                    res.status(statusCode_interface_1.STATUS_CODE.ACCEPTED).json({
                        success: true,
                        statusCode: statusCode_interface_1.STATUS_CODE.ACCEPTED,
                        message: 'Monthly fee generation job accepted for background processing',
                        jobId: job.id,
                        statusUrl: `/api/v1/hostel-ghar/fees/jobs/${job.id}`,
                    });
                    return;
                }
                const result = await this.feeService.generateMonthlyFeesForAllHostels(req.body?.billingMonth, req.body?.billingYear, req.body?.baseFee);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({ success: true, result });
            }
            catch (error) {
                next(error);
            }
        };
        /**
         * GET /fees/jobs/:jobId — Check progress/completion of an asynchronous fee generation job
         */
        this.getJobStatus = async (req, res, next) => {
            try {
                const jobId = (0, http_decorator_1.getRequiredParam)(req, 'jobId');
                const job = await queue_factory_1.systemEventQueue.getJob(jobId);
                if (!job) {
                    res.status(statusCode_interface_1.STATUS_CODE.NOT_FOUND).json({ success: false, message: 'Job not found' });
                    return;
                }
                const state = await job.getState();
                const isCompleted = state === 'completed';
                const isFailed = state === 'failed';
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    data: {
                        jobId: job.id,
                        state,
                        progress: job.progress,
                        result: isCompleted ? job.returnvalue : null,
                        failedReason: isFailed ? job.failedReason : null,
                    },
                });
            }
            catch (error) {
                next(error);
            }
        };
        /**
         * GET /fees/nepali-status — is today Nepali 1st? When will billing run?
         * Public helper for dashboards ("Next bill: 1 Kartik 2083").
         */
        this.nepaliBillingStatus = async (_req, res, next) => {
            try {
                const now = new Date();
                const bs = (0, nepali_date_util_1.toNepaliDate)(now);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    data: {
                        todayBs: bs,
                        todayBsLabel: `${bs.day} ${(0, nepali_date_util_1.formatNepaliMonthYear)(bs)} BS`,
                        isNepaliFirstDay: (0, nepali_date_util_1.isFirstDayOfNepaliMonth)(now),
                        currentBillingMonth: (0, nepali_date_util_1.formatNepaliMonthYear)(bs),
                    },
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.listHostelFees = async (req, res, next) => {
            try {
                const hostelId = (0, http_decorator_1.getRequiredParam)(req, 'hostelId');
                const { page, limit } = (0, pagination_util_1.normalizePagination)({
                    page: req.query.page,
                    limit: req.query.limit,
                });
                const result = await this.feeService.listHostelFees(hostelId, page, limit);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({ success: true, ...result });
            }
            catch (error) {
                next(error);
            }
        };
        this.recordPayment = async (req, res, next) => {
            try {
                const feeId = (0, http_decorator_1.getRequiredParam)(req, 'id');
                const result = await this.feeService.recordPayment(feeId, Number(req.body.paidAmount), req.user.userId);
                if (result.error) {
                    res.status(result.error.status).json({ success: false, message: result.error.message });
                    return;
                }
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({ success: true, data: result.data });
            }
            catch (error) {
                next(error);
            }
        };
        this.updateStatus = async (req, res, next) => {
            try {
                const feeId = (0, http_decorator_1.getRequiredParam)(req, 'id');
                const body = req.body;
                // Canonical wins when several aliases are sent together.
                const rawStatus = body.status ?? body.feeStatus ?? body.paymentStatus ?? body.payment_status;
                const status = typeof rawStatus === 'string' ? rawStatus.trim().toUpperCase() : rawStatus;
                if (!status || !Object.values(fee_enum_1.FeeStatus).includes(status)) {
                    res.status(statusCode_interface_1.STATUS_CODE.BAD_REQUEST).json({
                        success: false,
                        message: 'status must be one of: PENDING, PAID, OVERDUE, PARTIALLY_PAID',
                    });
                    return;
                }
                const rawPaidAmount = body.paidAmount ?? body.amount;
                const result = await this.feeService.updateFeeStatus(feeId, status, req.user.userId, rawPaidAmount !== undefined ? Number(rawPaidAmount) : undefined);
                if (result.error) {
                    res.status(result.error.status).json({ success: false, message: result.error.message });
                    return;
                }
                res
                    .status(statusCode_interface_1.STATUS_CODE.OK)
                    .json({ success: true, message: `Fee status updated to ${status}` });
            }
            catch (error) {
                next(error);
            }
        };
    }
}
exports.FeeController = FeeController;
