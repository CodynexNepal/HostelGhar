import { describe, expect, it } from 'vitest';
import {
  ALLOWED_ATTENDANCE_RADIUS_METERS,
  calculateDistanceMeters,
  extractClientIp,
  formatDuration,
  lookupIpCoordinates,
} from '../../src/utils/geolocation.util';
import {
  calculateAttendanceSummary,
  enrichAttendanceRecord,
} from '../../src/services/attendance/attendance.service';
import { Attendance } from '../../src/entities/attendance/attendance.entity';
import { AttendanceStatus } from '../../src/enum/attendance.enum';
import { Request } from 'express';

describe('attendance geolocation utility', () => {
  it('enforces 10 meters maximum radius constant', () => {
    expect(ALLOWED_ATTENDANCE_RADIUS_METERS).toBe(10);
  });

  it('calculates 0 meters for identical coordinates', () => {
    const lat = 27.7172;
    const lon = 85.324;
    const distance = calculateDistanceMeters(lat, lon, lat, lon);
    expect(distance).toBe(0);
  });

  it('calculates distances accurately using Haversine formula', () => {
    // Kathmandu Durbar Square (~27.7042, 85.3067) to Thamel (~27.7154, 85.3123)
    // Roughly 1.3 - 1.4 km
    const distance = calculateDistanceMeters(27.7042, 85.3067, 27.7154, 85.3123);
    expect(distance).toBeGreaterThan(1200);
    expect(distance).toBeLessThan(1600);

    // Very close coordinates (~5 meters)
    const lat1 = 27.7172;
    const lon1 = 85.324;
    const lat2 = 27.717245;
    const lon2 = 85.324;
    const closeDistance = calculateDistanceMeters(lat1, lon1, lat2, lon2);
    expect(closeDistance).toBeLessThan(10);
    expect(closeDistance).toBeLessThanOrEqual(ALLOWED_ATTENDANCE_RADIUS_METERS);
  });

  it('extracts client IP correctly from headers and strips IPv6 prefix', () => {
    const reqWithForwarded = {
      headers: { 'x-forwarded-for': '203.0.113.195, 70.41.3.18' },
      socket: { remoteAddress: '127.0.0.1' },
    } as unknown as Request;
    expect(extractClientIp(reqWithForwarded)).toBe('203.0.113.195');

    const reqWithIpv6 = {
      headers: {},
      socket: { remoteAddress: '::ffff:198.51.100.1' },
    } as unknown as Request;
    expect(extractClientIp(reqWithIpv6)).toBe('198.51.100.1');
  });

  it('looks up coordinates for public IP and returns null for loopback', () => {
    expect(lookupIpCoordinates('127.0.0.1')).toBeNull();
    expect(lookupIpCoordinates('::1')).toBeNull();
    expect(lookupIpCoordinates('192.168.1.50')).toBeNull();

    const result = lookupIpCoordinates('207.97.227.239');
    expect(result).not.toBeNull();
    expect(typeof result?.latitude).toBe('number');
    expect(typeof result?.longitude).toBe('number');
  });

  it('formats duration in minutes into friendly strings', () => {
    expect(formatDuration(0)).toBe('0m');
    expect(formatDuration(45)).toBe('45m');
    expect(formatDuration(60)).toBe('1h');
    expect(formatDuration(135)).toBe('2h 15m');
    expect(formatDuration(-10)).toBe('0m');
  });
});

describe('attendance enrichment and summary analytics', () => {
  it('enriches attendance record with stay and outside metrics', () => {
    const checkInAt = new Date('2026-10-31T09:00:00Z');
    const checkOutAt = new Date('2026-10-31T13:30:00Z'); // 4.5 hours = 270 mins
    const now = new Date('2026-10-31T15:00:00Z'); // 1.5 hours outside = 90 mins

    const record = {
      id: 'att-1',
      hostelId: 'hostel-1',
      residentId: 'res-1',
      date: '2026-10-31',
      status: AttendanceStatus.PRESENT,
      checkInAt,
      checkOutAt,
      checkInLatitude: 27.7172,
      checkInLongitude: 85.324,
      checkOutLatitude: 27.7173,
      checkOutLongitude: 85.3241,
      checkInDistanceMeters: 25.5,
      checkOutDistanceMeters: 30.2,
      checkInIp: '203.0.113.1',
      checkOutIp: '203.0.113.1',
      note: 'Normal check-in',
      recordedById: 'user-1',
      createdAt: checkInAt,
      updatedAt: checkOutAt,
    } as Attendance;

    const enriched = enrichAttendanceRecord(record, now);
    expect(enriched.timeSpentInHostelMinutes).toBe(270);
    expect(enriched.timeSpentInHostelFormatted).toBe('4h 30m');
    expect(enriched.timeSpentOutsideMinutes).toBe(90);
    expect(enriched.timeSpentOutsideFormatted).toBe('1h 30m');
    expect(enriched.isCurrentlyInside).toBe(false);
    expect(enriched.lastInTime).toEqual(checkInAt);
    expect(enriched.lastOutTime).toEqual(checkOutAt);
  });

  it('calculates currently inside when resident has not checked out', () => {
    const checkInAt = new Date('2026-10-31T10:00:00Z');
    const now = new Date('2026-10-31T12:15:00Z'); // 2 hours 15 mins inside

    const record = {
      id: 'att-2',
      hostelId: 'hostel-1',
      residentId: 'res-2',
      date: '2026-10-31',
      status: AttendanceStatus.PRESENT,
      checkInAt,
      checkOutAt: null,
    } as Attendance;

    const enriched = enrichAttendanceRecord(record, now);
    expect(enriched.timeSpentInHostelMinutes).toBe(135);
    expect(enriched.timeSpentInHostelFormatted).toBe('2h 15m');
    expect(enriched.timeSpentOutsideMinutes).toBe(0);
    expect(enriched.isCurrentlyInside).toBe(true);
  });

  it('aggregates summary statistics across multiple records', () => {
    const records = [
      enrichAttendanceRecord(
        {
          id: '1',
          status: AttendanceStatus.PRESENT,
          checkInAt: new Date('2026-10-31T08:00:00Z'),
          checkOutAt: null,
        } as Attendance,
        new Date('2026-10-31T10:00:00Z'),
      ), // 120 mins inside, 0 outside, inside=true
      enrichAttendanceRecord(
        {
          id: '2',
          status: AttendanceStatus.PRESENT,
          checkInAt: new Date('2026-10-31T08:00:00Z'),
          checkOutAt: new Date('2026-10-31T10:00:00Z'),
        } as Attendance,
        new Date('2026-10-31T11:00:00Z'),
      ), // 120 mins inside, 60 outside, inside=false
    ];

    const summary = calculateAttendanceSummary(records);
    expect(summary.totalRecords).toBe(2);
    expect(summary.presentCount).toBe(2);
    expect(summary.currentlyInside).toBe(1);
    expect(summary.currentlyOutside).toBe(1);
    expect(summary.totalTimeInHostelMinutes).toBe(240);
    expect(summary.averageTimeInHostelMinutes).toBe(120);
    expect(summary.totalTimeOutsideMinutes).toBe(60);
    expect(summary.averageTimeOutsideMinutes).toBe(30);
  });
});
