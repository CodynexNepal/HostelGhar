import 'reflect-metadata';
import express from 'express';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ownerRouter } from '../../src/routes/owner/owner.routes';
import { residentRouter } from '../../src/routes/resident/resident.routes';
import { notFoundHandler } from '../../src/middleware/not-found.middleware';
import { JwtTokenService } from '../../src/utils/jwt-token.util';
import { IROLES } from '../../src/enum/roles.enum';
import { todayAttendanceDate } from '../../src/services/attendance/attendance.service';

// Route-level checks for the attendance workflow: the owner GET route must
// exist (it previously 404'd), role gates must hold on both sides, and the
// resident check-in DTO must reject non-self-service statuses and unknown
// fields BEFORE any database access. No DB is touched.
const app = express();
app.use(express.json());
const routes = express.Router();
routes.use('/owner', ownerRouter);
routes.use('/resident', residentRouter);
app.use('/api/v1/hostel-ghar', routes);
app.use(notFoundHandler);

const HOSTEL_ID = 'a38bf07a-b7b1-49dc-85c8-dd5542a8e90a';

const ownerToken = JwtTokenService.generateAccessToken({
  userId: '00000000-0000-0000-0000-000000000021',
  email: 'owner@test.local',
  role: IROLES.OWNER,
});
const residentToken = JwtTokenService.generateAccessToken({
  userId: '00000000-0000-0000-0000-000000000022',
  email: 'resident@test.local',
  role: IROLES.RESIDENT,
});

let server: Server;
let baseUrl: string;

interface HttpResult {
  status: number;
  body: Record<string, unknown>;
}

const request = async (
  path: string,
  options: { token?: string; method?: string; body?: unknown } = {},
): Promise<HttpResult> => {
  const res = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
  // DTO validation failures (the ones these tests assert on) always return
  // JSON; later service failures may surface as HTML from Express's default
  // handler — tolerate both so `status` assertions stay meaningful.
  const text = await res.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    parsed = { raw: text };
  }
  return { status: res.status, body: parsed };
};

beforeAll(async () => {
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
});

describe('GET /owner/attendance (owner dashboard list)', () => {
  it('resolves on the owner router — 401 without a token, not the 404 Route-not-found', async () => {
    const { status } = await request(`/api/v1/hostel-ghar/owner/attendance?hostelId=${HOSTEL_ID}`);
    expect(status).toBe(401);
  });

  it('forbids residents via the owner/admin role gate (403 proves the route matched)', async () => {
    const { status } = await request(`/api/v1/hostel-ghar/owner/attendance?hostelId=${HOSTEL_ID}`, {
      token: residentToken,
    });
    expect(status).toBe(403);
  });
});

describe('POST /resident/attendance/check-in (resident self check-in)', () => {
  it('requires authentication', async () => {
    const { status } = await request('/api/v1/hostel-ghar/resident/attendance/check-in', {
      method: 'POST',
      body: {},
    });
    expect(status).toBe(401);
  });

  it('forbids owners — only residents/admins self check-in', async () => {
    const { status } = await request('/api/v1/hostel-ghar/resident/attendance/check-in', {
      token: ownerToken,
      method: 'POST',
      body: { status: 'PRESENT' },
    });
    expect(status).toBe(403);
  });

  it('accepts an empty body (status defaults to PRESENT) — 422 only for invalid input', async () => {
    // validateDto passes {}; the non-422 that follows comes from the service
    // hitting an unreachable DB — ANY non-422 means validation passed.
    const { status } = await request('/api/v1/hostel-ghar/resident/attendance/check-in', {
      token: residentToken,
      method: 'POST',
      body: {},
    });
    expect(status).not.toBe(422);
  });

  it('accepts PRESENT and LATE, rejects owner-only statuses (422)', async () => {
    for (const value of ['PRESENT', 'late', 'LATE']) {
      const { status } = await request('/api/v1/hostel-ghar/resident/attendance/check-in', {
        token: residentToken,
        method: 'POST',
        body: { status: value },
      });
      expect(status).not.toBe(422);
    }
    for (const value of ['ABSENT', 'HALF_DAY', 'ON_LEAVE', 'NOT_A_STATUS']) {
      const { status, body } = await request('/api/v1/hostel-ghar/resident/attendance/check-in', {
        token: residentToken,
        method: 'POST',
        body: { status: value },
      });
      expect(status).toBe(422);
      expect(String(body.message).toLowerCase()).toContain('validation');
    }
  });

  it('rejects unknown body fields (whitelist via forbidNonWhitelisted)', async () => {
    const { status } = await request('/api/v1/hostel-ghar/resident/attendance/check-in', {
      token: residentToken,
      method: 'POST',
      body: { status: 'PRESENT', hostelId: 'sneaky' },
    });
    expect(status).toBe(422);
  });

  it('rejects an over-long note (max 500 chars)', async () => {
    const { status } = await request('/api/v1/hostel-ghar/resident/attendance/check-in', {
      token: residentToken,
      method: 'POST',
      body: { note: 'x'.repeat(501) },
    });
    expect(status).toBe(422);
  });
});

describe('GET /resident/attendance (my attendance history)', () => {
  it('requires authentication', async () => {
    const { status } = await request('/api/v1/hostel-ghar/resident/attendance');
    expect(status).toBe(401);
  });

  it('forbids owners via the resident role gate', async () => {
    const { status } = await request('/api/v1/hostel-ghar/resident/attendance', {
      token: ownerToken,
    });
    expect(status).toBe(403);
  });
});

describe('attendance date helper', () => {
  it('formats Nepal-time dates as YYYY-MM-DD', () => {
    // 2026-01-31T20:30:00Z is already 2026-02-01 in Asia/Kathmandu (UTC+5:45).
    expect(todayAttendanceDate(new Date('2026-01-31T20:30:00Z'))).toBe('2026-02-01');
    // 2026-01-31T10:00:00Z is still 2026-01-31 in Kathmandu.
    expect(todayAttendanceDate(new Date('2026-01-31T10:00:00Z'))).toBe('2026-01-31');
  });
});

describe('unknown routes', () => {
  it('still 404 genuinely unknown attendance sub-paths', async () => {
    const { status, body } = await request('/api/v1/hostel-ghar/owner/attendance/does-not-exist', {
      token: ownerToken,
    });
    expect(status).toBe(404);
    expect(String(body.message)).toContain('Route not found');
  });
});
