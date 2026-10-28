// ──────────────────────────────────────────────────────────────────────────────
// FILE: location.service.ts
// PURPOSE: Business logic, caching, authorization, and persistence for hostel location.
// ──────────────────────────────────────────────────────────────────────────────

import { AppDataSource } from '../../database/database-source';
import { Hostel } from '../../entities/hostel/hostel.entity';
import { IROLES } from '../../enum/roles.enum';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { cacheService } from '../../utils/cache.util';
import { UpdateHostelLocationDto } from '../../dto/location/location.dto';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isUuidV4 = (v: unknown): v is string =>
  typeof v === 'string' && UUID_V4.test(v.trim());

export interface HostelLocationResponse {
  hostelId: string;
  latitude: number | null;
  longitude: number | null;
  isLocationShared: boolean;
  locationUpdatedAt: Date | null;
  address: string | null;
  city: string | null;
}

export class LocationService {
  private key(hostelId: string): string {
    return cacheService.generateKey('hostel:location', { hostelId, v: 1 });
  }

  private async invalidate(hostelId: string): Promise<void> {
    await cacheService.invalidatePattern('public:hostel');
    await cacheService.invalidatePattern('hostels');
    await cacheService.invalidate(this.key(hostelId)).catch(() => undefined);
  }

  private async verifyHostelOwner(
    hostelId: string,
    user: { userId: string; role: string },
  ): Promise<{ error?: { status: number; message: string }; hostel?: Hostel }> {
    const hostelRepo = AppDataSource.getRepository(Hostel);
    const hostel = await hostelRepo.findOne({
      where: { id: hostelId },
    });

    if (!hostel) {
      return {
        error: { status: STATUS_CODE.NOT_FOUND, message: 'Hostel not found' },
      };
    }

    const role = user.role?.toLowerCase();
    if (role === IROLES.ADMIN) {
      return { hostel };
    }

    if (role === IROLES.OWNER) {
      if (hostel.ownerId !== user.userId) {
        return {
          error: {
            status: STATUS_CODE.FORBIDDEN,
            message: 'You do not own or have permission to manage this hostel',
          },
        };
      }
      return { hostel };
    }

    return {
      error: {
        status: STATUS_CODE.FORBIDDEN,
        message: 'Access denied: only hostel owners or administrators can manage location',
      },
    };
  }

  public async getLocation(
    hostelId: string,
    user?: { userId: string; role: string },
  ): Promise<{ data?: HostelLocationResponse; error?: { status: number; message: string } }> {
    if (!isUuidV4(hostelId)) {
      return {
        error: { status: STATUS_CODE.BAD_REQUEST, message: 'Invalid hostel id — must be UUID v4' },
      };
    }

    const hostelRepo = AppDataSource.getRepository(Hostel);
    const hostel = await hostelRepo.findOne({
      where: { id: hostelId },
      select: {
        id: true,
        name: true,
        ownerId: true,
        isActive: true,
        latitude: true,
        longitude: true,
        isLocationShared: true,
        locationUpdatedAt: true,
        address: true,
        city: true,
      },
    });

    if (!hostel) {
      return {
        error: { status: STATUS_CODE.NOT_FOUND, message: 'Hostel not found' },
      };
    }

    // Authenticated owner or admin request
    if (user) {
      const authCheck = await this.verifyHostelOwner(hostelId, user);
      if (authCheck.error) {
        return { error: authCheck.error };
      }

      return {
        data: {
          hostelId: hostel.id,
          latitude: hostel.latitude,
          longitude: hostel.longitude,
          isLocationShared: hostel.isLocationShared,
          locationUpdatedAt: hostel.locationUpdatedAt,
          address: hostel.address,
          city: hostel.city,
        },
      };
    }

    // Public request
    if (!hostel.isActive) {
      return {
        error: { status: STATUS_CODE.NOT_FOUND, message: 'Hostel is inactive or not found' },
      };
    }

    // If public sharing is enabled, return verified coordinates
    if (hostel.isLocationShared) {
      return {
        data: {
          hostelId: hostel.id,
          latitude: hostel.latitude,
          longitude: hostel.longitude,
          isLocationShared: true,
          locationUpdatedAt: hostel.locationUpdatedAt,
          address: hostel.address,
          city: hostel.city,
        },
      };
    }

    // If sharing is disabled, never leak coordinates
    return {
      data: {
        hostelId: hostel.id,
        latitude: null,
        longitude: null,
        isLocationShared: false,
        locationUpdatedAt: null,
        address: hostel.address,
        city: hostel.city,
      },
    };
  }

  public async updateLocation(
    hostelId: string,
    user: { userId: string; role: string },
    dto: UpdateHostelLocationDto,
  ): Promise<{ data?: HostelLocationResponse; error?: { status: number; message: string } }> {
    if (!isUuidV4(hostelId)) {
      return {
        error: { status: STATUS_CODE.BAD_REQUEST, message: 'Invalid hostel id — must be UUID v4' },
      };
    }

    const authCheck = await this.verifyHostelOwner(hostelId, user);
    if (authCheck.error || !authCheck.hostel) {
      return {
        error: authCheck.error ?? {
          status: STATUS_CODE.FORBIDDEN,
          message: 'Access denied to hostel',
        },
      };
    }

    const hostel = authCheck.hostel;

    // Coordinate validation
    if (dto.latitude !== undefined) {
      if (dto.latitude !== null && (dto.latitude < -90 || dto.latitude > 90)) {
        return {
          error: {
            status: STATUS_CODE.VALIDATION_ERROR,
            message: 'Latitude must be between -90 and 90 degrees',
          },
        };
      }
    }

    if (dto.longitude !== undefined) {
      if (dto.longitude !== null && (dto.longitude < -180 || dto.longitude > 180)) {
        return {
          error: {
            status: STATUS_CODE.VALIDATION_ERROR,
            message: 'Longitude must be between -180 and 180 degrees',
          },
        };
      }
    }

    const newLat = dto.latitude !== undefined ? dto.latitude : hostel.latitude;
    const newLng = dto.longitude !== undefined ? dto.longitude : hostel.longitude;

    if (dto.isLocationShared && (newLat === null || newLng === null)) {
      return {
        error: {
          status: STATUS_CODE.VALIDATION_ERROR,
          message: 'Cannot share location publicly without saving valid coordinates first',
        },
      };
    }

    hostel.latitude = newLat;
    hostel.longitude = newLng;
    hostel.isLocationShared = dto.isLocationShared;
    hostel.locationUpdatedAt = new Date();

    const hostelRepo = AppDataSource.getRepository(Hostel);
    const saved = await hostelRepo.save(hostel);
    await this.invalidate(hostelId);

    return {
      data: {
        hostelId: saved.id,
        latitude: saved.latitude,
        longitude: saved.longitude,
        isLocationShared: saved.isLocationShared,
        locationUpdatedAt: saved.locationUpdatedAt,
        address: saved.address,
        city: saved.city,
      },
    };
  }
}
