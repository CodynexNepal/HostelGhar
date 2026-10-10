// ──────────────────────────────────────────────────────────────────────────────
// FILE: platform-qr.service.ts
// PURPOSE: Business logic for Hostel Ghar PLATFORM checkout QRs (eSewa / Khalti
//          / Bank) that owners scan on `/subscription`. There is exactly one
//          active QR per method, so create() upserts by method and the public
//          list serves only active rows.
// ──────────────────────────────────────────────────────────────────────────────

import { STATUS_CODE } from '../../constant/statusCode.interface';
import { PlatformQr } from '../../entities/platform-qr/platform-qr.entity';
import { PlatformQrMethod } from '../../enum/platform-qr.enum';
import { PlatformQrRepository } from '../../repository/platform-qr/platform-qr.repository';
import { CreatePlatformQrDto } from '../../dto/platform-qr/create-platform-qr.dto';
import { UpdatePlatformQrDto } from '../../dto/platform-qr/update-platform-qr.dto';
import { imageUploadService } from '../upload/image-upload.service';
import { createHttpError } from '../../utils/createHttpError';

/** Public view returned to owners on the Subscription checkout page. */
export interface PlatformQrView {
  id: string;
  method: PlatformQrMethod;
  qrImageUrl: string;
  label: string;
  isActive: boolean;
  updatedAt: Date;
  createdAt: Date;
}

function toView(qr: PlatformQr): PlatformQrView {
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

export class PlatformQrService {
  constructor(
    private readonly platformQrRepository: PlatformQrRepository = new PlatformQrRepository(),
  ) {}

  /** Admin list — every configured checkout QR (active + inactive). */
  public async listAll(): Promise<PlatformQrView[]> {
    const rows = await this.platformQrRepository.findAll();
    return rows.map(toView);
  }

  /** Owner/public list — only the QRs currently shown at checkout. */
  public async listActive(): Promise<PlatformQrView[]> {
    const rows = await this.platformQrRepository.findAll({ onlyActive: true });
    return rows.map(toView);
  }

  /**
   * Create OR replace the QR for a method. Because there is one QR per method,
   * a POST with an existing method updates that row in place (keeps the same id)
   * so the dashboard's create/update flow stays idempotent.
   */
  public async create(
    dto: CreatePlatformQrDto,
    file?: Express.Multer.File,
  ): Promise<PlatformQrView> {
    const existing = await this.platformQrRepository.findByMethod(dto.method);
    if (existing) {
      return this.applyChanges(existing, dto, file);
    }

    let qrImageUrl = dto.qrImageUrl?.trim() ?? '';
    let qrImagePublicId: string | null = null;

    if (file && file.buffer) {
      const uploaded = await imageUploadService.uploadPlatformQrCode(file, dto.method);
      qrImageUrl = uploaded.url;
      qrImagePublicId = uploaded.publicId;
    }

    if (!qrImageUrl) {
      throw createHttpError(
        STATUS_CODE.BAD_REQUEST,
        'A QR image is required — upload a file or provide qrImageUrl',
      );
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
  public async update(
    id: string,
    dto: UpdatePlatformQrDto,
    file?: Express.Multer.File,
  ): Promise<PlatformQrView> {
    const existing = await this.platformQrRepository.findById(id);
    if (!existing) {
      throw createHttpError(STATUS_CODE.NOT_FOUND, 'Platform QR not found');
    }
    return this.applyChanges(existing, dto, file);
  }

  /** Remove a platform QR by id and clean up its Cloudinary asset. */
  public async remove(id: string): Promise<{ message: string; id: string }> {
    const existing = await this.platformQrRepository.findById(id);
    if (!existing) {
      throw createHttpError(STATUS_CODE.NOT_FOUND, 'Platform QR not found');
    }

    if (existing.qrImagePublicId) {
      imageUploadService
        .deleteAsset(existing.qrImagePublicId)
        .catch((err) =>
          console.warn(
            `[PlatformQrService] Failed to delete Cloudinary asset ${existing.qrImagePublicId}: ${err.message}`,
          ),
        );
    }

    await this.platformQrRepository.delete(id);
    return { message: 'Platform QR removed successfully', id };
  }

  /** Shared create/update mutation: new file wins, then JSON url, then keep old. */
  private async applyChanges(
    existing: PlatformQr,
    dto: CreatePlatformQrDto | UpdatePlatformQrDto,
    file?: Express.Multer.File,
  ): Promise<PlatformQrView> {
    if (file && file.buffer) {
      const uploaded = await imageUploadService.uploadPlatformQrCode(
        file,
        dto.method ?? existing.method,
        existing.qrImagePublicId,
      );
      existing.qrImageUrl = uploaded.url;
      existing.qrImagePublicId = uploaded.publicId;
    } else if ('qrImageUrl' in dto && dto.qrImageUrl !== undefined) {
      const nextUrl = dto.qrImageUrl?.trim() ?? '';
      if (nextUrl) {
        existing.qrImageUrl = nextUrl;
        // Replacing a URL-sourced image detaches any previous Cloudinary asset.
        existing.qrImagePublicId = null;
      }
    }

    if (dto.method !== undefined) existing.method = dto.method;
    if (dto.label !== undefined) existing.label = dto.label.trim();
    if (dto.isActive !== undefined) existing.isActive = dto.isActive;

    const saved = await this.platformQrRepository.save(existing);
    return toView(saved);
  }
}
