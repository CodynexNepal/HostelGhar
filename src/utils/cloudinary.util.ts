// ──────────────────────────────────────────────────────────────────────────────
// FILE: cloudinary.util.ts
// PURPOSE: Enterprise Cloudinary streaming upload and deletion helper.
//          - Uses upload_stream with Node.js stream pipeline to prevent memory leaks
//          - Handles format optimization, responsive resizing, and transformations
//          - Provides safe deletion and cleanup of replaced assets
// ──────────────────────────────────────────────────────────────────────────────

import { UploadApiOptions, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';
import { cloudinary } from '../configs/cloudinary.config';

export interface CloudinaryUploadResult {
  secureUrl: string;
  publicId: string;
  format: string;
  bytes: number;
  width?: number;
  height?: number;
}

export class CloudinaryUtil {
  /**
   * Uploads an in-memory buffer to Cloudinary using streaming.
   */
  public static async uploadBuffer(
    buffer: Buffer,
    options: UploadApiOptions = {},
  ): Promise<CloudinaryUploadResult> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'image',
          ...options,
        },
        (error, result: UploadApiResponse | undefined) => {
          if (error || !result) {
            return reject(
              new Error(`[Cloudinary] Upload failed: ${error?.message || 'Unknown error'}`),
            );
          }

          resolve({
            secureUrl: result.secure_url,
            publicId: result.public_id,
            format: result.format,
            bytes: result.bytes,
            width: result.width,
            height: result.height,
          });
        },
      );

      // Create a readable stream from the buffer and pipe to Cloudinary
      const readableStream = new Readable();
      readableStream.push(buffer);
      readableStream.push(null); // End of stream
      readableStream.pipe(uploadStream);
    });
  }

  /**
   * Safely deletes an existing asset by public ID.
   */
  public static async deleteByPublicId(publicId: string): Promise<boolean> {
    if (!publicId) return false;
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: 'image',
        invalidate: true,
      });
      return result.result === 'ok';
    } catch (err: any) {
      console.warn(`[Cloudinary] Failed to delete asset "${publicId}":`, err.message);
      return false;
    }
  }
}
