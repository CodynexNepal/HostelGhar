import 'reflect-metadata';
import express from 'express';
import cookieParser from 'cookie-parser';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AuthController } from '../../src/controller/auth/auth.controller';
import { JwtTokenService } from '../../src/utils/jwt-token.util';
import { IROLES } from '../../src/enum/roles.enum';

vi.mock('../../src/services/auth/logout.service', () => ({
  logoutService: {
    logout: async (input: Record<string, unknown>) => ({
      userId: (input.userId as string) ?? 'u-1',
      logoutAll: (input.logoutAll as boolean) ?? false,
      devicesRevoked: (input.logoutAll as boolean) ? 'all' : 'current',
      accessTokenRevoked: true,
      refreshTokenRevoked: true,
      cacheKeysPurged: 3,
      socketsNotified: true,
    }),
  },
}));

const loggedOut: unknown[] = [];
const fakeService = {
  logout: async (uid: string) => {
    loggedOut.push(uid);
  },
} as never;
const controller = new AuthController(fakeService);

const app = express();
app.use(express.json());
app.use(cookieParser());
app.post('/api/v1/hostel-ghar/auth/logout', controller.logout);
app.post('/api/v1/hostel-ghar/auth/logout/all', controller.logoutAll);

let server: Server;
let base: string;

const token = JwtTokenService.generateAccessToken({
  userId: '00000000-0000-0000-0000-000000000099',
  email: 'logout@test.local',
  role: IROLES.OWNER,
});

const post = async (path: string, opts: { token?: string; body?: unknown } = {}) => {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(opts.body ?? {}),
  });
  const setCookie = res.headers.get('set-cookie') ?? '';
  return { status: res.status, body: (await res.json()) as Record<string, unknown>, setCookie };
};

beforeAll(async () => {
  server = createServer(app);
  await new Promise<void>((r) => server.listen(0, r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((r, j) => server.close((e) => (e ? j(e) : r())));
});

describe('production logout endpoints', () => {
  it('POST /auth/logout revokes current device, clears cookies', async () => {
    const { status, body, setCookie } = await post('/api/v1/hostel-ghar/auth/logout', { token });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect((body.data as Record<string, unknown>).devicesRevoked).toBe('current');
    expect(setCookie.toLowerCase()).toContain('access_token=');
  });

  it('POST /auth/logout?logoutAll=true revokes all devices', async () => {
    const { status, body } = await post('/api/v1/hostel-ghar/auth/logout?logoutAll=true', {
      token,
    });
    expect(status).toBe(200);
    expect(body.message).toMatch(/revoked/i);
    expect((body.data as Record<string, unknown>).devicesRevoked).toBe('all');
  });

  it('POST /auth/logout/all is the explicit all-devices kill switch', async () => {
    const { status, body } = await post('/api/v1/hostel-ghar/auth/logout/all', { token });
    expect(status).toBe(200);
    expect((body.data as Record<string, unknown>).devicesRevoked).toBe('all');
  });

  it('works without any token (idempotent, still clears cookies)', async () => {
    const { status, body } = await post('/api/v1/hostel-ghar/auth/logout', {});
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });
});
