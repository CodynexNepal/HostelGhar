// ──────────────────────────────────────────────────────────────────────────────
// FILE: image-upload.service.ts
// PURPOSE: Specialized image processing & Cloudinary upload service.
//          Separates logic for Hostel Logos and Student/Resident Images.
// ──────────────────────────────────────────────────────────────────────────────

import { CloudinaryUtil, CloudinaryUploadResult } from '../../utils/cloudinary.util';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { createHttpError } from '../../utils/createHttpError';

export interface ImageUploadResponse {
  url: string;
  publicId: string;
  bytes: number;
  format: string;
}

export class ImageUploadService {
  public async uploadOwnerAvatar(
    file: Express.Multer.File,
    ownerId: string,
  ): Promise<ImageUploadResponse> {
    if (!file || !file.buffer) {
      throw createHttpError(STATUS_CODE.BAD_REQUEST, 'Owner image file is required');
    }

    const result: CloudinaryUploadResult = await CloudinaryUtil.uploadBuffer(file.buffer, {
      folder: 'hostelghar/owners/avatars',
      public_id: `owner_${ownerId}_avatar_${Date.now()}`,
      overwrite: true,
      transformation: [
        { width: 500, height: 500, crop: 'thumb', gravity: 'face' },
        { quality: 'auto:good', fetch_format: 'webp' },
      ],
      tags: ['owner_avatar', `owner_${ownerId}`],
    });

    return {
      url: result.secureUrl,
      publicId: result.publicId,
      bytes: result.bytes,
      format: result.format,
    };
  }

  /**
   * ─── 1. HOSTEL LOGO UPLOAD LOGIC ──────────────────────────────────────────
   * - Target Folder: `hostelghar/logos`
   * - Transformation: 500x500 square fit, WEBP format, automatic quality
   * - Cleans up previous logo asset from Cloudinary if replacing
   */
  public async uploadHostelLogo(
    file: Express.Multer.File,
    hostelId: string,
    previousPublicId?: string | null,
  ): Promise<ImageUploadResponse> {
    if (!file || !file.buffer) {
      throw createHttpError(STATUS_CODE.BAD_REQUEST, 'Logo image file is required');
    }

    // 1. Upload new logo with logo-specific transformations
    const result: CloudinaryUploadResult = await CloudinaryUtil.uploadBuffer(file.buffer, {
      folder: 'hostelghar/logos',
      public_id: `hostel_${hostelId}_logo_${Date.now()}`,
      overwrite: true,
      transformation: [
        { width: 500, height: 500, crop: 'limit' },
        { quality: 'auto:good', fetch_format: 'webp' },
      ],
      tags: ['hostel_logo', `hostel_${hostelId}`],
    });

    // 2. Delete old logo in background (non-blocking) if it exists
    if (previousPublicId) {
      CloudinaryUtil.deleteByPublicId(previousPublicId).catch((err) =>
        console.warn(`[ImageUploadService] Could not delete old logo ${previousPublicId}:`, err),
      );
    }

    return {
      url: result.secureUrl,
      publicId: result.publicId,
      bytes: result.bytes,
      format: result.format,
    };
  }

  /**
   * ─── 2. STUDENT / RESIDENT PHOTO UPLOAD LOGIC ─────────────────────────────
   * - Target Folder: `hostelghar/students/photos`
   * - Transformation: 400x400 portrait with SMART FACE DETECTION gravity, WEBP
   * - Cleans up previous photo asset from Cloudinary if replacing
   */
  public async uploadStudentPhoto(
    file: Express.Multer.File,
    residentId: string,
    previousPublicId?: string | null,
  ): Promise<ImageUploadResponse> {
    if (!file || !file.buffer) {
      throw createHttpError(STATUS_CODE.BAD_REQUEST, 'Student photo image file is required');
    }

    // 1. Upload with smart face-centering portrait transformation
    const result: CloudinaryUploadResult = await CloudinaryUtil.uploadBuffer(file.buffer, {
      folder: 'hostelghar/students/photos',
      public_id: `student_${residentId}_photo_${Date.now()}`,
      overwrite: true,
      transformation: [
        { width: 400, height: 400, crop: 'thumb', gravity: 'face' },
        { quality: 'auto', fetch_format: 'webp' },
      ],
      tags: ['student_photo', `student_${residentId}`],
    });

    // 2. Delete old photo in background if it exists
    if (previousPublicId) {
      CloudinaryUtil.deleteByPublicId(previousPublicId).catch((err) =>
        console.warn(`[ImageUploadService] Could not delete old photo ${previousPublicId}:`, err),
      );
    }

    return {
      url: result.secureUrl,
      publicId: result.publicId,
      bytes: result.bytes,
      format: result.format,
    };
  }

  /**
   * ─── 3. STUDENT / RESIDENT DOCUMENT UPLOAD LOGIC ──────────────────────────
   * - Target Folder: `hostelghar/students/documents`
   * - Transformation: High-resolution preservation (up to 1600px width), auto quality
   * - Cleans up previous document asset from Cloudinary if replacing
   */
  public async uploadStudentDocument(
    file: Express.Multer.File,
    residentId: string,
    previousPublicId?: string | null,
  ): Promise<ImageUploadResponse> {
    if (!file || !file.buffer) {
      throw createHttpError(STATUS_CODE.BAD_REQUEST, 'Student document image file is required');
    }

    // 1. Upload with high-res document preservation
    const result: CloudinaryUploadResult = await CloudinaryUtil.uploadBuffer(file.buffer, {
      folder: 'hostelghar/students/documents',
      public_id: `student_${residentId}_doc_${Date.now()}`,
      overwrite: true,
      transformation: [{ width: 1600, height: 1600, crop: 'limit' }, { quality: 'auto:best' }],
      tags: ['student_document', `student_${residentId}`],
    });

    // 2. Delete old document in background if it exists
    if (previousPublicId) {
      CloudinaryUtil.deleteByPublicId(previousPublicId).catch((err) =>
        console.warn(`[ImageUploadService] Could not delete old doc ${previousPublicId}:`, err),
      );
    }

    return {
      url: result.secureUrl,
      publicId: result.publicId,
      bytes: result.bytes,
      format: result.format,
    };
  }

  /**
   * ─── 4. ROOM IMAGE UPLOAD LOGIC ───────────────────────────────────────────
   * - Target Folder: `hostelghar/rooms`
   * - Transformation: 800x600 limit fit, WEBP format, automatic quality
   * - Cleans up previous room asset from Cloudinary if replacing
   */
  public async uploadRoomImage(
    file: Express.Multer.File,
    roomId: string,
    ownerId: string,
    previousPublicId?: string | null,
  ): Promise<ImageUploadResponse> {
    if (!file || !file.buffer) {
      throw createHttpError(STATUS_CODE.BAD_REQUEST, 'Room image file is required');
    }

    const result: CloudinaryUploadResult = await CloudinaryUtil.uploadBuffer(file.buffer, {
      folder: 'hostelghar/rooms',
      public_id: `room_${roomId}_${Date.now()}`,
      overwrite: true,
      transformation: [
        { width: 800, height: 600, crop: 'limit' },
        { quality: 'auto:good', fetch_format: 'webp' },
      ],
      tags: ['room_image', `owner_${ownerId}`],
    });

    if (previousPublicId) {
      CloudinaryUtil.deleteByPublicId(previousPublicId).catch((err) =>
        console.warn(
          `[ImageUploadService] Could not delete old room image ${previousPublicId}:`,
          err,
        ),
      );
    }

    return {
      url: result.secureUrl,
      publicId: result.publicId,
      bytes: result.bytes,
      format: result.format,
    };
  }

  /**
   * General asset deletion by public ID
   */
  public async deleteAsset(publicId: string): Promise<boolean> {
    return await CloudinaryUtil.deleteByPublicId(publicId);
  }
}

export const imageUploadService = new ImageUploadService();
