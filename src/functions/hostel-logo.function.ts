// ──────────────────────────────────────────────────────────────────────────────
// FILE: hostel-logo.function.ts
// PURPOSE: Modular, isolated function for processing and uploading hostel logos.
//          Can be imported into createHostel, updateHostel, or dedicated upload handlers.
// ──────────────────────────────────────────────────────────────────────────────

import { imageUploadService, ImageUploadResponse } from '../services/upload/image-upload.service';

/**
 * Uploads or replaces a Hostel logo in Cloudinary with standard transformations.
 *
 * @param file - The uploaded logo file buffer from Multer
 * @param hostelId - UUID of the hostel
 * @param previousPublicId - Optional previous Cloudinary public ID to delete
 * @returns Cloudinary URL, public ID, format, and bytes
 */
export async function processHostelLogoUpload(
  file: Express.Multer.File,
  hostelId: string,
  previousPublicId?: string | null,
): Promise<ImageUploadResponse> {
  return await imageUploadService.uploadHostelLogo(file, hostelId, previousPublicId);
}
