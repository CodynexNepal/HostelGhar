"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: hostel-logo.function.ts
// PURPOSE: Modular, isolated function for processing and uploading hostel logos.
//          Can be imported into createHostel, updateHostel, or dedicated upload handlers.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.processHostelLogoUpload = processHostelLogoUpload;
const image_upload_service_1 = require("../services/upload/image-upload.service");
/**
 * Uploads or replaces a Hostel logo in Cloudinary with standard transformations.
 *
 * @param file - The uploaded logo file buffer from Multer
 * @param hostelId - UUID of the hostel
 * @param previousPublicId - Optional previous Cloudinary public ID to delete
 * @returns Cloudinary URL, public ID, format, and bytes
 */
async function processHostelLogoUpload(file, hostelId, previousPublicId) {
    return await image_upload_service_1.imageUploadService.uploadHostelLogo(file, hostelId, previousPublicId);
}
