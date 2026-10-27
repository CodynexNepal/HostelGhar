"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: cloudinary.util.ts
// PURPOSE: Enterprise Cloudinary streaming upload and deletion helper.
//          - Uses upload_stream with Node.js stream pipeline to prevent memory leaks
//          - Handles format optimization, responsive resizing, and transformations
//          - Provides safe deletion and cleanup of replaced assets
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloudinaryUtil = void 0;
const stream_1 = require("stream");
const cloudinary_config_1 = require("../configs/cloudinary.config");
class CloudinaryUtil {
    /**
     * Uploads an in-memory buffer to Cloudinary using streaming.
     */
    static async uploadBuffer(buffer, options = {}) {
        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary_config_1.cloudinary.uploader.upload_stream({
                resource_type: 'image',
                ...options,
            }, (error, result) => {
                if (error || !result) {
                    return reject(new Error(`[Cloudinary] Upload failed: ${error?.message || 'Unknown error'}`));
                }
                resolve({
                    secureUrl: result.secure_url,
                    publicId: result.public_id,
                    format: result.format,
                    bytes: result.bytes,
                    width: result.width,
                    height: result.height,
                });
            });
            // Create a readable stream from the buffer and pipe to Cloudinary
            const readableStream = new stream_1.Readable();
            readableStream.push(buffer);
            readableStream.push(null); // End of stream
            readableStream.pipe(uploadStream);
        });
    }
    /**
     * Safely deletes an existing asset by public ID.
     */
    static async deleteByPublicId(publicId) {
        if (!publicId)
            return false;
        try {
            const result = await cloudinary_config_1.cloudinary.uploader.destroy(publicId, {
                resource_type: 'image',
                invalidate: true,
            });
            return result.result === 'ok';
        }
        catch (err) {
            console.warn(`[Cloudinary] Failed to delete asset "${publicId}":`, err.message);
            return false;
        }
    }
}
exports.CloudinaryUtil = CloudinaryUtil;
