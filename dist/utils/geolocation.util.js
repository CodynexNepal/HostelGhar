"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: geolocation.util.ts
// PURPOSE: Geofencing, GeoIP lookup, distance calculations (Haversine formula),
//          and duration formatting for resident attendance check-in/check-out.
// ──────────────────────────────────────────────────────────────────────────────
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatDuration = exports.calculateDistanceMeters = exports.lookupIpCoordinates = exports.extractClientIp = exports.ALLOWED_ATTENDANCE_RADIUS_METERS = void 0;
const geoip_lite_1 = __importDefault(require("geoip-lite"));
/** Maximum permitted distance (in meters) from hostel location for check-in/out.
 * Set to 750 meters to comfortably allow residents within 700M of the hostel. */
exports.ALLOWED_ATTENDANCE_RADIUS_METERS = 750;
/**
 * Normalizes client IP address from Express Request headers or socket,
 * stripping IPv6 mapped prefixes (e.g., ::ffff:192.168.1.1).
 */
const extractClientIp = (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    let rawIp;
    if (typeof forwarded === 'string' && forwarded.trim().length > 0) {
        rawIp = forwarded.split(',')[0]?.trim();
    }
    else if (Array.isArray(forwarded) && forwarded.length > 0) {
        rawIp = forwarded[0]?.trim();
    }
    if (!rawIp) {
        const realIp = req.headers['x-real-ip'];
        if (typeof realIp === 'string' && realIp.trim().length > 0) {
            rawIp = realIp.trim();
        }
    }
    if (!rawIp) {
        rawIp = req.socket?.remoteAddress || req.ip || '';
    }
    // Strip IPv6-mapped IPv4 prefix
    if (rawIp.startsWith('::ffff:')) {
        rawIp = rawIp.replace('::ffff:', '');
    }
    return rawIp.trim();
};
exports.extractClientIp = extractClientIp;
/**
 * Looks up geographic coordinates (lat, lon) for an IP address using geoip-lite.
 * Returns null for local/private/unresolved IP addresses.
 */
const lookupIpCoordinates = (ip) => {
    if (!ip ||
        ip === '127.0.0.1' ||
        ip === '::1' ||
        ip.startsWith('192.168.') ||
        ip.startsWith('10.')) {
        return null;
    }
    try {
        const geo = geoip_lite_1.default.lookup(ip);
        if (!geo || !geo.ll || geo.ll.length < 2) {
            return null;
        }
        const [latitude, longitude] = geo.ll;
        if (typeof latitude !== 'number' || typeof longitude !== 'number') {
            return null;
        }
        return {
            latitude,
            longitude,
            city: geo.city || null,
            country: geo.country || null,
        };
    }
    catch {
        return null;
    }
};
exports.lookupIpCoordinates = lookupIpCoordinates;
/**
 * Calculates great-circle distance between two (latitude, longitude) coordinates
 * in meters using the Haversine formula.
 */
const calculateDistanceMeters = (lat1, lon1, lat2, lon2) => {
    const EARTH_RADIUS_METERS = 6371e3; // Mean Earth radius in meters
    const toRadians = (deg) => (deg * Math.PI) / 180;
    const φ1 = toRadians(lat1);
    const φ2 = toRadians(lat2);
    const Δφ = toRadians(lat2 - lat1);
    const Δλ = toRadians(lon2 - lon1);
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EARTH_RADIUS_METERS * c;
};
exports.calculateDistanceMeters = calculateDistanceMeters;
/**
 * Formats duration in minutes into human-readable string (e.g., "3h 25m", "45m").
 */
const formatDuration = (minutes) => {
    if (minutes <= 0 || !Number.isFinite(minutes))
        return '0m';
    const wholeMinutes = Math.floor(minutes);
    const hours = Math.floor(wholeMinutes / 60);
    const mins = wholeMinutes % 60;
    if (hours > 0 && mins > 0)
        return `${hours}h ${mins}m`;
    if (hours > 0)
        return `${hours}h`;
    return `${mins}m`;
};
exports.formatDuration = formatDuration;
