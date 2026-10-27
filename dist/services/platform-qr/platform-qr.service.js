"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: platform-qr.service.ts
// PURPOSE: Business logic for Hostel Ghar PLATFORM checkout QRs (eSewa / Khalti
//          / Bank) that owners scan on `/subscription`. There is exactly one
//          active QR per method, so create() upserts by method and the public
//          list serves only active rows.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlatformQrService = void 0;
const statusCode_interface_1 = require("../../constant/statusCode.interface");
const platform_qr_repository_1 = require("../../repository/platform-qr/platform-qr.repository");
const image_upload_service_1 = require("../upload/image-upload.service");
const createHttpError_1 = require("../../utils/createHttpError");
function toView(qr) {
    return {
        id: qr.id,
        method: qr.method,
        qrImageUrl: qr.qrImageUrl,
        label: qr.label,
        isActive: qr.isActive,
        updatedAt: qr.updatedAt,
        createdAt: qr.createdAt,
    };
}
class PlatformQrService {
    constructor(platformQrRepository = new platform_qr_repository_1.PlatformQrRepository()) {
        this.platformQrRepository = platformQrRepository;
    }
    /** Admin list — every configured checkout QR (active + inactive). */
    async listAll() {
        const rows = await this.platformQrRepository.findAll();
        return rows.map(toView);
    }
    /** Owner/public list — only the QRs currently shown at checkout. */
    async listActive() {
        const rows = await this.platformQrRepository.findAll({ onlyActive: true });
        return rows.map(toView);
    }
    /**
     * Create OR replace the QR for a method. Because there is one QR per method,
     * a POST with an existing method updates that row in place (keeps the same id)
     * so the dashboard's create/update flow stays idempotent.
     */
    async create(dto, file) {
        const existing = await this.platformQrRepository.findByMethod(dto.method);
        if (existing) {
            return this.applyChanges(existing, dto, file);
        }
        let qrImageUrl = dto.qrImageUrl?.trim() ?? '';
        let qrImagePublicId = null;
        if (file && file.buffer) {
            const uploaded = await image_upload_service_1.imageUploadService.uploadPlatformQrCode(file, dto.method);
            qrImageUrl = uploaded.url;
            qrImagePublicId = uploaded.publicId;
        }
        if (!qrImageUrl) {
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.BAD_REQUEST, 'A QR image is required — upload a file or provide qrImageUrl');
        }
        const entity = this.platformQrRepository.create({
            method: dto.method,
            qrImageUrl,
            qrImagePublicId,
            label: dto.label?.trim() ?? '',
            isActive: dto.isActive !== undefined ? dto.isActive : true,
        });
        const saved = await this.platformQrRepository.save(entity);
        return toView(saved);
    }
    /** Replace image and/or label for an existing platform QR by id. */
    async update(id, dto, file) {
        const existing = await this.platformQrRepository.findById(id);
        if (!existing) {
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.NOT_FOUND, 'Platform QR not found');
        }
        return this.applyChanges(existing, dto, file);
    }
    /** Remove a platform QR by id and clean up its Cloudinary asset. */
    async remove(id) {
        const existing = await this.platformQrRepository.findById(id);
        if (!existing) {
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.NOT_FOUND, 'Platform QR not found');
        }
        if (existing.qrImagePublicId) {
            image_upload_service_1.imageUploadService
                .deleteAsset(existing.qrImagePublicId)
                .catch((err) => console.warn(`[PlatformQrService] Failed to delete Cloudinary asset ${existing.qrImagePublicId}: ${err.message}`));
        }
        await this.platformQrRepository.delete(id);
        return { message: 'Platform QR removed successfully', id };
    }
    /** Shared create/update mutation: new file wins, then JSON url, then keep old. */
    async applyChanges(existing, dto, file) {
        if (file && file.buffer) {
            const uploaded = await image_upload_service_1.imageUploadService.uploadPlatformQrCode(file, dto.method ?? existing.method, existing.qrImagePublicId);
            existing.qrImageUrl = uploaded.url;
            existing.qrImagePublicId = uploaded.publicId;
        }
        else if ('qrImageUrl' in dto && dto.qrImageUrl !== undefined) {
            const nextUrl = dto.qrImageUrl?.trim() ?? '';
            if (nextUrl) {
                existing.qrImageUrl = nextUrl;
                // Replacing a URL-sourced image detaches any previous Cloudinary asset.
                existing.qrImagePublicId = null;
            }
        }
        if (dto.method !== undefined)
            existing.method = dto.method;
        if (dto.label !== undefined)
            existing.label = dto.label.trim();
        if (dto.isActive !== undefined)
            existing.isActive = dto.isActive;
        const saved = await this.platformQrRepository.save(existing);
        return toView(saved);
    }
}
exports.PlatformQrService = PlatformQrService;
