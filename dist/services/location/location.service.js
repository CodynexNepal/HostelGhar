"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: location.service.ts
// PURPOSE: Business logic, caching, authorization, and persistence for hostel location.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocationService = exports.isUuidV4 = void 0;
const database_source_1 = require("../../database/database-source");
const hostel_entity_1 = require("../../entities/hostel/hostel.entity");
const roles_enum_1 = require("../../enum/roles.enum");
const statusCode_interface_1 = require("../../constant/statusCode.interface");
const cache_util_1 = require("../../utils/cache.util");
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuidV4 = (v) => typeof v === 'string' && UUID_V4.test(v.trim());
exports.isUuidV4 = isUuidV4;
class LocationService {
    key(hostelId) {
        return cache_util_1.cacheService.generateKey('hostel:location', { hostelId, v: 1 });
    }
    async invalidate(hostelId) {
        await cache_util_1.cacheService.invalidatePattern('public:hostel');
        await cache_util_1.cacheService.invalidatePattern('hostels');
        await cache_util_1.cacheService.invalidate(this.key(hostelId)).catch(() => undefined);
    }
    async verifyHostelOwner(hostelId, user) {
        const hostelRepo = database_source_1.AppDataSource.getRepository(hostel_entity_1.Hostel);
        const hostel = await hostelRepo.findOne({
            where: { id: hostelId },
        });
        if (!hostel) {
            return {
                error: { status: statusCode_interface_1.STATUS_CODE.NOT_FOUND, message: 'Hostel not found' },
            };
        }
        const role = user.role?.toLowerCase();
        if (role === roles_enum_1.IROLES.ADMIN) {
            return { hostel };
        }
        if (role === roles_enum_1.IROLES.OWNER) {
            if (hostel.ownerId !== user.userId) {
                return {
                    error: {
                        status: statusCode_interface_1.STATUS_CODE.FORBIDDEN,
                        message: 'You do not own or have permission to manage this hostel',
                    },
                };
            }
            return { hostel };
        }
        return {
            error: {
                status: statusCode_interface_1.STATUS_CODE.FORBIDDEN,
                message: 'Access denied: only hostel owners or administrators can manage location',
            },
        };
    }
    async getLocation(hostelId, user) {
        if (!(0, exports.isUuidV4)(hostelId)) {
            return {
                error: { status: statusCode_interface_1.STATUS_CODE.BAD_REQUEST, message: 'Invalid hostel id — must be UUID v4' },
            };
        }
        const hostelRepo = database_source_1.AppDataSource.getRepository(hostel_entity_1.Hostel);
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
                error: { status: statusCode_interface_1.STATUS_CODE.NOT_FOUND, message: 'Hostel not found' },
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
                error: { status: statusCode_interface_1.STATUS_CODE.NOT_FOUND, message: 'Hostel is inactive or not found' },
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
    async updateLocation(hostelId, user, dto) {
        if (!(0, exports.isUuidV4)(hostelId)) {
            return {
                error: { status: statusCode_interface_1.STATUS_CODE.BAD_REQUEST, message: 'Invalid hostel id — must be UUID v4' },
            };
        }
        const authCheck = await this.verifyHostelOwner(hostelId, user);
        if (authCheck.error || !authCheck.hostel) {
            return {
                error: authCheck.error ?? {
                    status: statusCode_interface_1.STATUS_CODE.FORBIDDEN,
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
                        status: statusCode_interface_1.STATUS_CODE.VALIDATION_ERROR,
                        message: 'Latitude must be between -90 and 90 degrees',
                    },
                };
            }
        }
        if (dto.longitude !== undefined) {
            if (dto.longitude !== null && (dto.longitude < -180 || dto.longitude > 180)) {
                return {
                    error: {
                        status: statusCode_interface_1.STATUS_CODE.VALIDATION_ERROR,
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
                    status: statusCode_interface_1.STATUS_CODE.VALIDATION_ERROR,
                    message: 'Cannot share location publicly without saving valid coordinates first',
                },
            };
        }
        hostel.latitude = newLat;
        hostel.longitude = newLng;
        hostel.isLocationShared = dto.isLocationShared;
        hostel.locationUpdatedAt = new Date();
        const hostelRepo = database_source_1.AppDataSource.getRepository(hostel_entity_1.Hostel);
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
exports.LocationService = LocationService;
