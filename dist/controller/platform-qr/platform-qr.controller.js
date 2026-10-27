"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: platform-qr.controller.ts
// PURPOSE: HTTP handlers for Hostel Ghar PLATFORM checkout QRs. Admin CRUD lives
//          under /admin/platform-qrs; owners read the active list (mounted by
//          the public router). Mirrors the payment-qr controller's envelope.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlatformQrController = void 0;
const statusCode_interface_1 = require("../../constant/statusCode.interface");
const platform_qr_service_1 = require("../../services/platform-qr/platform-qr.service");
const upload_middleware_1 = require("../../middleware/upload.middleware");
const http_decorator_1 = require("../../decorators/http.decorator");
class PlatformQrController {
    constructor(platformQrService = new platform_qr_service_1.PlatformQrService()) {
        this.platformQrService = platformQrService;
        /** GET /admin/platform-qrs — list every configured checkout QR (admin). */
        this.listAll = async (_req, res, next) => {
            try {
                const data = await this.platformQrService.listAll();
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({ success: true, data });
            }
            catch (error) {
                next(error);
            }
        };
        /** GET /platform-qrs — active checkout QRs owners scan on /subscription. */
        this.listActive = async (_req, res, next) => {
            try {
                const data = await this.platformQrService.listActive();
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({ success: true, data });
            }
            catch (error) {
                next(error);
            }
        };
        /** POST /admin/platform-qrs — upload a checkout QR (multipart `qrImage` or JSON url). */
        this.create = async (req, res, next) => {
            try {
                const dto = req.body;
                const file = (0, upload_middleware_1.pickPlatformQrFile)(req);
                const data = await this.platformQrService.create(dto, file);
                res.status(statusCode_interface_1.STATUS_CODE.CREATED).json({
                    success: true,
                    message: 'Platform QR created successfully',
                    data,
                });
            }
            catch (error) {
                next(error);
            }
        };
        /** PUT /admin/platform-qrs/:id — replace image and/or label. */
        this.update = async (req, res, next) => {
            try {
                const id = (0, http_decorator_1.getRequiredParam)(req, 'id');
                const dto = req.body;
                const file = (0, upload_middleware_1.pickPlatformQrFile)(req);
                const data = await this.platformQrService.update(id, dto, file);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    message: 'Platform QR updated successfully',
                    data,
                });
            }
            catch (error) {
                next(error);
            }
        };
        /** DELETE /admin/platform-qrs/:id — remove a checkout QR. */
        this.remove = async (req, res, next) => {
            try {
                const id = (0, http_decorator_1.getRequiredParam)(req, 'id');
                const data = await this.platformQrService.remove(id);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({ success: true, ...data });
            }
            catch (error) {
                next(error);
            }
        };
    }
}
exports.PlatformQrController = PlatformQrController;
