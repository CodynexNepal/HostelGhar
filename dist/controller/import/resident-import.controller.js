"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.residentImportController = exports.ResidentImportController = void 0;
const statusCode_interface_1 = require("../../constant/statusCode.interface");
const upload_middleware_1 = require("../../middleware/upload.middleware");
const resident_import_service_1 = require("../../services/resident/resident-import.service");
class ResidentImportController {
    constructor() {
        this.downloadTemplate = async (req, res, next) => {
            try {
                const tpl = resident_import_service_1.residentImportService.getTemplate();
                res.setHeader('Content-Type', tpl.contentType);
                res.setHeader('Content-Disposition', `attachment; filename="${tpl.fileName}"`);
                res.status(statusCode_interface_1.STATUS_CODE.OK).send(tpl.content);
            }
            catch (error) {
                next(error);
            }
        };
        this.getPlanLimits = async (req, res, next) => {
            try {
                res
                    .status(statusCode_interface_1.STATUS_CODE.OK)
                    .json({ success: true, data: resident_import_service_1.residentImportService.getPlanLimits() });
            }
            catch (error) {
                next(error);
            }
        };
        this.startImport = async (req, res, next) => {
            try {
                const ownerId = req.user.userId;
                const role = req.user.role?.toLowerCase() ?? '';
                // resolveHostelId runs before multer, so req.hostelId is authoritative.
                // Fallback covers clients that send hostelId as multipart text field.
                const rawHostel = req.hostelId ?? req.body?.hostelId;
                const hostelId = typeof rawHostel === 'string' ? rawHostel.trim() : rawHostel;
                if (!hostelId) {
                    res.status(statusCode_interface_1.STATUS_CODE.BAD_REQUEST).json({ success: false, message: 'hostelId required' });
                    return;
                }
                const file = (0, upload_middleware_1.pickResidentCsvFile)(req);
                if (!file?.buffer) {
                    res.status(statusCode_interface_1.STATUS_CODE.BAD_REQUEST).json({
                        success: false,
                        message: 'CSV file required in the multipart upload. Use a valid CSV file field such as "file" or "csv".',
                    });
                    return;
                }
                const idem = req.headers['idempotency-key'];
                const result = await resident_import_service_1.residentImportService.enqueueImport({
                    hostelId,
                    ownerId,
                    role,
                    fileName: file.originalname || 'residents.csv',
                    fileBuffer: file.buffer,
                    idempotencyKey: typeof idem === 'string' ? idem : undefined,
                });
                if (result.error || !result.data) {
                    const status = result.error?.status ?? statusCode_interface_1.STATUS_CODE.BAD_REQUEST;
                    res.status(status).json({
                        success: false,
                        message: result.error?.message ?? 'Import failed',
                        errors: result.error?.details ?? undefined,
                    });
                    return;
                }
                res.status(statusCode_interface_1.STATUS_CODE.SUCCESS).json({
                    success: true,
                    replayed: result.data.replayed,
                    message: result.data.replayed
                        ? 'Import already queued (idempotent replay)'
                        : 'Import queued for background processing',
                    data: result.data.import,
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.getHistory = async (req, res, next) => {
            try {
                const ownerId = req.user.userId;
                const role = req.user.role?.toLowerCase() ?? '';
                const page = Number(req.query.page ?? 1);
                const limit = Number(req.query.limit ?? 20);
                const hostelId = typeof req.query.hostelId === 'string' ? req.query.hostelId : undefined;
                const result = await resident_import_service_1.residentImportService.getHistory({
                    ownerId,
                    role,
                    page,
                    limit,
                    hostelId,
                });
                if (result.error || !result.data) {
                    res
                        .status(result.error?.status ?? 500)
                        .json({ success: false, message: result.error?.message ?? 'Failed' });
                    return;
                }
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({ success: true, ...result.data });
            }
            catch (error) {
                next(error);
            }
        };
        this.getDetail = async (req, res, next) => {
            try {
                const ownerId = req.user.userId;
                const role = req.user.role?.toLowerCase() ?? '';
                const importId = req.params.id;
                const result = await resident_import_service_1.residentImportService.getDetail({ importId, ownerId, role });
                if (result.error || !result.data) {
                    res
                        .status(result.error?.status ?? 500)
                        .json({ success: false, message: result.error?.message ?? 'Failed' });
                    return;
                }
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({ success: true, data: result.data });
            }
            catch (error) {
                next(error);
            }
        };
    }
}
exports.ResidentImportController = ResidentImportController;
exports.residentImportController = new ResidentImportController();
