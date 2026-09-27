// ──────────────────────────────────────────────────────────────────────────────
// FILE: payment-qr.service.ts
// PURPOSE: Business logic for Hostel Payment QR Codes (eSewa, Khalti, Bank Transfer).
//          Supports resident view, owner management, demo QR seeding,
//          replacement (PUT), partial updates (PATCH), and removal (DELETE).
// ──────────────────────────────────────────────────────────────────────────────

import { STATUS_CODE } from '../../constant/statusCode.interface';
import { IROLES } from '../../enum/roles.enum';
import { PaymentMethod } from '../../enum/payment-qr.enum';
import { PaymentQr } from '../../entities/payment-qr/payment-qr.entity';
import { PaymentQrRepository } from '../../repository/payment-qr/payment-qr.repository';
import { CreatePaymentQrDto } from '../../dto/payment-qr/create-payment-qr.dto';
import { UpdatePaymentQrDto } from '../../dto/payment-qr/update-payment-qr.dto';
import { PatchPaymentQrDto } from '../../dto/payment-qr/patch-payment-qr.dto';
import { imageUploadService } from '../upload/image-upload.service';
import { cacheService } from '../../utils/cache.util';
import { createHttpError } from '../../utils/createHttpError';

export interface ResidentPaymentQrView {
  id: string;
  paymentMethod: PaymentMethod;
  title: string;
  subtitle: string | null;
  accountName: string;
  accountIdentifier: string;
  bankName: string | null;
  displayText: string;
  qrCodeUrl: string;
  isActive: boolean;
  instructions: string | null;
}

export interface ResidentPaymentQrsResponse {
  hostel: {
    id: string;
    name: string;
  };
  notice: string;
  paymentQrs: ResidentPaymentQrView[];
}

export class PaymentQrService {
  constructor(
    private readonly qrRepository: PaymentQrRepository = new PaymentQrRepository(),
  ) {}

  /**
   * Generates canonical display text for QR card beneath code
   */
  public generateDisplayText(
    method: PaymentMethod,
    accountName: string,
    accountIdentifier: string,
    bankName?: string | null,
  ): string {
    const cleanAccountName = accountName.trim();
    const cleanId = accountIdentifier.trim();

    switch (method) {
      case PaymentMethod.ESEWA:
        return `eSewa ID: ${cleanId} • ${cleanAccountName}`;
      case PaymentMethod.KHALTI:
        return `Khalti ID: ${cleanId} • ${cleanAccountName}`;
      case PaymentMethod.BANK_TRANSFER: {
        const bank = bankName?.trim() || 'Bank Transfer';
        return `${bank} • A/C: ${cleanId} • ${cleanAccountName}`;
      }
      default:
        return `${cleanId} • ${cleanAccountName}`;
    }
  }

  /**
   * Resolves defaults for title and subtitle if missing
   */
  private getMethodDefaults(method: PaymentMethod): { title: string; subtitle: string } {
    switch (method) {
      case PaymentMethod.ESEWA:
        return { title: 'eSewa', subtitle: 'Scan & Pay via eSewa App' };
      case PaymentMethod.KHALTI:
        return { title: 'Khalti', subtitle: 'Scan & Pay via Khalti App' };
      case PaymentMethod.BANK_TRANSFER:
        return { title: 'Bank Transfer', subtitle: 'Scan with any Mobile Banking App' };
    }
  }

  /**
   * Verifies hostel access for owner or admin. Returns resolved hostel ID.
   */
  private async resolveAndAuthorizeHostel(
    actorId: string,
    actorRole: string,
    requestedHostelId?: string,
  ): Promise<string> {
    const isAdmin = actorRole.toLowerCase() === IROLES.ADMIN.toLowerCase();

    if (requestedHostelId) {
      const hostel = await this.qrRepository.findHostelById(requestedHostelId);
      if (!hostel) {
        throw createHttpError(STATUS_CODE.NOT_FOUND, 'Hostel not found');
      }
      if (!isAdmin && hostel.ownerId !== actorId) {
        throw createHttpError(
          STATUS_CODE.FORBIDDEN,
          'You are not authorized to manage payment QRs for this hostel',
        );
      }
      return hostel.id;
    }

    // If no hostelId provided, attempt to resolve from owner's hostels
    if (isAdmin) {
      throw createHttpError(STATUS_CODE.BAD_REQUEST, 'hostelId is required for admin');
    }

    const ownerHostels = await this.qrRepository.findHostelsByOwner(actorId);
    if (!ownerHostels.length) {
      throw createHttpError(
        STATUS_CODE.BAD_REQUEST,
        'No hostel found for your account. Please create or assign a hostel first.',
      );
    }

    return ownerHostels[0]?.id as string;
  }

  /**
   * Invalidate caches related to payment QRs
   */
  private async invalidateCache(hostelId: string): Promise<void> {
    await Promise.all([
      cacheService.invalidatePattern(`payment-qrs:${hostelId}`),
      cacheService.invalidatePattern(`resident:payment-qrs`),
    ]);
  }

  /**
   * List all payment QRs for a hostel (Owner & Admin management view)
   */
  public async listPaymentQrsForHostel(
    actorId: string,
    actorRole: string,
    hostelId?: string,
    isActiveFilter?: boolean,
  ): Promise<{ hostelId: string; paymentQrs: PaymentQr[] }> {
    const resolvedHostelId = await this.resolveAndAuthorizeHostel(
      actorId,
      actorRole,
      hostelId,
    );

    const paymentQrs = await this.qrRepository.findByHostel(resolvedHostelId, {
      onlyActive: isActiveFilter as boolean,
    });

    return {
      hostelId: resolvedHostelId,
      paymentQrs,
    };
  }

  /**
   * Resident View: Get active payment QRs for "My Payments"
   */
  public async getResidentPaymentQrs(
    userId: string,
    hostelIdOverride?: string,
  ): Promise<ResidentPaymentQrsResponse> {
    let resolvedHostelId = hostelIdOverride;
    let hostelName = 'Hostel';

    if (!resolvedHostelId) {
      const resident = await this.qrRepository.findResidentByUserId(userId);
      if (!resident) {
        throw createHttpError(
          STATUS_CODE.NOT_FOUND,
          'Active resident profile not found for this user account',
        );
      }
      resolvedHostelId = resident.hostelId;
      hostelName = resident.hostel?.name || 'Hostel';
    } else {
      const hostel = await this.qrRepository.findHostelById(resolvedHostelId);
      if (hostel) {
        hostelName = hostel.name;
      }
    }

    const qrs = await this.qrRepository.findByHostel(resolvedHostelId, { onlyActive: true });

    return {
      hostel: {
        id: resolvedHostelId,
        name: hostelName,
      },
      notice:
        'Residents see these QR codes under My Payments. After scanning and paying, they can present their transaction reference or screenshot at the desk.',
      paymentQrs: qrs.map((qr) => ({
        id: qr.id,
        paymentMethod: qr.paymentMethod,
        title: qr.title,
        subtitle: qr.subtitle,
        accountName: qr.accountName,
        accountIdentifier: qr.accountIdentifier,
        bankName: qr.bankName,
        displayText:
          qr.displayText ||
          this.generateDisplayText(
            qr.paymentMethod,
            qr.accountName,
            qr.accountIdentifier,
            qr.bankName,
          ),
        qrCodeUrl: qr.qrCodeUrl,
        isActive: qr.isActive,
        instructions:
          qr.instructions || 'Displayed beneath the QR code so residents can verify or copy it',
      })),
    };
  }

  /**
   * Preview Resident View (for Owners/Admins testing what residents see)
   */
  public async previewResidentView(
    actorId: string,
    actorRole: string,
    hostelId?: string,
  ): Promise<ResidentPaymentQrsResponse> {
    const resolvedHostelId = await this.resolveAndAuthorizeHostel(
      actorId,
      actorRole,
      hostelId,
    );
    return this.getResidentPaymentQrs(actorId, resolvedHostelId);
  }

  /**
   * Get single Payment QR by ID
   */
  public async getPaymentQrById(
    actorId: string,
    actorRole: string,
    id: string,
  ): Promise<PaymentQr> {
    const qr = await this.qrRepository.findById(id);
    if (!qr) {
      throw createHttpError(STATUS_CODE.NOT_FOUND, 'Payment QR code not found');
    }

    const isAdmin = actorRole.toLowerCase() === IROLES.ADMIN.toLowerCase();
    const isResident = actorRole.toLowerCase() === IROLES.RESIDENT.toLowerCase();

    if (!isAdmin && !isResident) {
      const hostel = await this.qrRepository.findHostelById(qr.hostelId);
      if (hostel && hostel.ownerId !== actorId) {
        throw createHttpError(STATUS_CODE.FORBIDDEN, 'Unauthorized access to this payment QR');
      }
    }

    return qr;
  }

  /**
   * Create a new Payment QR Code (POST)
   */
  public async createPaymentQr(
    actorId: string,
    actorRole: string,
    dto: CreatePaymentQrDto,
    file?: Express.Multer.File,
  ): Promise<PaymentQr> {
    const hostelId = await this.resolveAndAuthorizeHostel(actorId, actorRole, dto.hostelId);
    const defaults = this.getMethodDefaults(dto.paymentMethod);

    let qrCodeUrl = dto.qrCodeUrl;
    let qrCodePublicId: string | null = null;

    if (file && file.buffer) {
      const uploaded = await imageUploadService.uploadPaymentQrCode(
        file,
        hostelId,
        dto.paymentMethod,
      );
      qrCodeUrl = uploaded.url;
      qrCodePublicId = uploaded.publicId;
    }

    if (!qrCodeUrl) {
      // Fallback to generated demo QR code URL if no file or URL was supplied
      qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(
        `${dto.paymentMethod}:${dto.accountIdentifier}:${dto.accountName}`,
      )}`;
    }

    const title = dto.title?.trim() || defaults.title;
    const subtitle = dto.subtitle?.trim() || defaults.subtitle;
    const displayText =
      dto.displayText?.trim() ||
      this.generateDisplayText(
        dto.paymentMethod,
        dto.accountName,
        dto.accountIdentifier,
        dto.bankName,
      );

    const qrEntity = this.qrRepository.create({
      hostelId,
      paymentMethod: dto.paymentMethod,
      title,
      subtitle,
      accountName: dto.accountName.trim(),
      accountIdentifier: dto.accountIdentifier.trim(),
      bankName: dto.bankName?.trim() || null,
      displayText,
      qrCodeUrl,
      qrCodePublicId,
      isActive: dto.isActive !== undefined ? dto.isActive : true,
      instructions:
        dto.instructions?.trim() ||
        'Displayed beneath the QR code so residents can verify or copy it',
    });

    const saved = await this.qrRepository.save(qrEntity);
    await this.invalidateCache(hostelId);
    return saved;
  }

  /**
   * "Load Demo QRs": Seeds standard eSewa, Khalti, and Bank Transfer QRs
   */
  public async loadDemoQRs(
    actorId: string,
    actorRole: string,
    hostelId?: string,
  ): Promise<{ message: string; data: PaymentQr[] }> {
    const resolvedHostelId = await this.resolveAndAuthorizeHostel(
      actorId,
      actorRole,
      hostelId,
    );

    const hostel = await this.qrRepository.findHostelById(resolvedHostelId);
    const hostelName = hostel?.name || 'Sunrise Hostel';

    const demoSpecs = [
      {
        paymentMethod: PaymentMethod.ESEWA,
        title: 'eSewa',
        subtitle: 'Scan & Pay via eSewa App',
        accountName: hostelName,
        accountIdentifier: '9841000001',
        bankName: null,
        displayText: `eSewa ID: 9841000001 • ${hostelName}`,
        qrCodeUrl:
          'https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=esewa%3A%2F%2Fpay%3Fid%3D9841000001%26name%3DSunrise%2BHostel',
      },
      {
        paymentMethod: PaymentMethod.KHALTI,
        title: 'Khalti',
        subtitle: 'Scan & Pay via Khalti App',
        accountName: hostelName,
        accountIdentifier: '9841000001',
        bankName: null,
        displayText: `Khalti ID: 9841000001 • ${hostelName}`,
        qrCodeUrl:
          'https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=khalti%3A%2F%2Fpay%3Fid%3D9841000001%26name%3DSunrise%2BHostel',
      },
      {
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        title: 'Bank Transfer',
        subtitle: 'Scan with any Mobile Banking App',
        accountName: hostelName,
        accountIdentifier: '01201017500123',
        bankName: 'Nabil Bank',
        displayText: `Nabil Bank • A/C: 01201017500123 • ${hostelName}`,
        qrCodeUrl:
          'https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=fonepay%3A%2F%2Fpay%3Facct%3D01201017500123%26bank%3DNabil%2BHostel',
      },
    ];

    const results: PaymentQr[] = [];

    for (const spec of demoSpecs) {
      let existing = await this.qrRepository.findByHostelAndMethod(
        resolvedHostelId,
        spec.paymentMethod,
      );

      if (existing) {
        existing.title = spec.title;
        existing.subtitle = spec.subtitle;
        existing.accountName = spec.accountName;
        existing.accountIdentifier = spec.accountIdentifier;
        existing.bankName = spec.bankName;
        existing.displayText = spec.displayText;
        existing.qrCodeUrl = spec.qrCodeUrl;
        existing.isActive = true;
        existing.instructions =
          'Displayed beneath the QR code so residents can verify or copy it';
        results.push(await this.qrRepository.save(existing));
      } else {
        const newQr = this.qrRepository.create({
          hostelId: resolvedHostelId,
          paymentMethod: spec.paymentMethod,
          title: spec.title,
          subtitle: spec.subtitle,
          accountName: spec.accountName,
          accountIdentifier: spec.accountIdentifier,
          bankName: spec.bankName,
          displayText: spec.displayText,
          qrCodeUrl: spec.qrCodeUrl,
          qrCodePublicId: null,
          isActive: true,
          instructions: 'Displayed beneath the QR code so residents can verify or copy it',
        });
        results.push(await this.qrRepository.save(newQr));
      }
    }

    await this.invalidateCache(resolvedHostelId);

    return {
      message: 'Demo payment QR codes loaded successfully',
      data: results,
    };
  }

  /**
   * "Replace QR" / Full Update (PUT)
   */
  public async replacePaymentQr(
    actorId: string,
    actorRole: string,
    id: string,
    dto: UpdatePaymentQrDto,
    file?: Express.Multer.File,
  ): Promise<PaymentQr> {
    const existing = await this.getPaymentQrById(actorId, actorRole, id);

    // If new file is uploaded, replace via Cloudinary and clean previous image
    if (file && file.buffer) {
      const upload = await imageUploadService.uploadPaymentQrCode(
        file,
        existing.hostelId,
        dto.paymentMethod || existing.paymentMethod,
        existing.qrCodePublicId,
      );
      existing.qrCodeUrl = upload.url;
      existing.qrCodePublicId = upload.publicId;
    } else if (dto.qrCodeUrl) {
      existing.qrCodeUrl = dto.qrCodeUrl;
    }

    if (dto.paymentMethod) {
      existing.paymentMethod = dto.paymentMethod;
    }
    if (dto.title !== undefined) existing.title = dto.title;
    if (dto.subtitle !== undefined) existing.subtitle = dto.subtitle;
    if (dto.accountName !== undefined) existing.accountName = dto.accountName;
    if (dto.accountIdentifier !== undefined) existing.accountIdentifier = dto.accountIdentifier;
    if (dto.bankName !== undefined) existing.bankName = dto.bankName;
    if (dto.isActive !== undefined) existing.isActive = dto.isActive;
    if (dto.instructions !== undefined) existing.instructions = dto.instructions;

    // Recalculate or update displayText
    if (dto.displayText !== undefined) {
      existing.displayText = dto.displayText;
    } else {
      existing.displayText = this.generateDisplayText(
        existing.paymentMethod,
        existing.accountName,
        existing.accountIdentifier,
        existing.bankName,
      );
    }

    const saved = await this.qrRepository.save(existing);
    await this.invalidateCache(existing.hostelId);
    return saved;
  }

  /**
   * Partial Update (PATCH)
   */
  public async patchPaymentQr(
    actorId: string,
    actorRole: string,
    id: string,
    dto: PatchPaymentQrDto,
    file?: Express.Multer.File,
  ): Promise<PaymentQr> {
    const existing = await this.getPaymentQrById(actorId, actorRole, id);

    if (file && file.buffer) {
      const upload = await imageUploadService.uploadPaymentQrCode(
        file,
        existing.hostelId,
        dto.paymentMethod || existing.paymentMethod,
        existing.qrCodePublicId,
      );
      existing.qrCodeUrl = upload.url;
      existing.qrCodePublicId = upload.publicId;
    } else if (dto.qrCodeUrl !== undefined) {
      existing.qrCodeUrl = dto.qrCodeUrl;
    }

    if (dto.paymentMethod !== undefined) existing.paymentMethod = dto.paymentMethod;
    if (dto.title !== undefined) existing.title = dto.title;
    if (dto.subtitle !== undefined) existing.subtitle = dto.subtitle;
    if (dto.accountName !== undefined) existing.accountName = dto.accountName;
    if (dto.accountIdentifier !== undefined) existing.accountIdentifier = dto.accountIdentifier;
    if (dto.bankName !== undefined) existing.bankName = dto.bankName;
    if (dto.isActive !== undefined) existing.isActive = dto.isActive;
    if (dto.instructions !== undefined) existing.instructions = dto.instructions;

    if (dto.displayText !== undefined) {
      existing.displayText = dto.displayText;
    } else if (
      dto.paymentMethod !== undefined ||
      dto.accountName !== undefined ||
      dto.accountIdentifier !== undefined ||
      dto.bankName !== undefined
    ) {
      existing.displayText = this.generateDisplayText(
        existing.paymentMethod,
        existing.accountName,
        existing.accountIdentifier,
        existing.bankName,
      );
    }

    const saved = await this.qrRepository.save(existing);
    await this.invalidateCache(existing.hostelId);
    return saved;
  }

  /**
   * Toggle Active / Inactive Status (PATCH /toggle)
   */
  public async toggleActiveStatus(
    actorId: string,
    actorRole: string,
    id: string,
  ): Promise<PaymentQr> {
    const existing = await this.getPaymentQrById(actorId, actorRole, id);
    existing.isActive = !existing.isActive;

    const saved = await this.qrRepository.save(existing);
    await this.invalidateCache(existing.hostelId);
    return saved;
  }

  /**
   * "Remove" (DELETE)
   */
  public async deletePaymentQr(
    actorId: string,
    actorRole: string,
    id: string,
  ): Promise<{ message: string; id: string }> {
    const existing = await this.getPaymentQrById(actorId, actorRole, id);

    if (existing.qrCodePublicId) {
      imageUploadService.deleteAsset(existing.qrCodePublicId).catch((err) =>
        console.warn(`[PaymentQrService] Failed to delete Cloudinary asset: ${err.message}`),
      );
    }

    await this.qrRepository.delete(id);
    await this.invalidateCache(existing.hostelId);

    return {
      message: 'Payment QR code removed successfully',
      id,
    };
  }
}
