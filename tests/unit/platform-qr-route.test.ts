import 'reflect-metadata';
import express from 'express';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { notFoundHandler } from '../../src/middleware/not-found.middleware';
import { JwtTokenService } from '../../src/utils/jwt-token.util';
import { IROLES } from '../../src/enum/roles.enum';
import { authenticate, requireRoles } from '../../src/middleware/auth.middleware';
import {
  platformQrAdminRouter,
  platformQrPublicRouter,
} from '../../src/routes/platform-qr/platform-qr.routes';

// Guards the platform checkout QR endpoints the dashboard relies on:
//   • admin  GET/POST/PUT/DELETE /admin/platform-qrs[/:id]
//   • owner  GET /platform-qrs (active only)
// They must require auth + the right role, validate via DTOs, and — critically
// for the dashboard — return real data (NOT 404), which is what previously
// forced the frontend into its localStorage fallback. The factory is stubbed so
// no DB/Cloudinary is touched.
vi.mock('../../src/factory/platform-qr/platform-qr.factory', () => {
  const rows: Record<string, unknown>[] = [
    {
      id: 'qr-esewa',
      method: 'ESEWA',
      qrImageUrl: 'https://cdn/esewa.png',
      label: 'eSewa ID: 98XXXXXXXX',
      isActive: true,
    },
    {
      id: 'qr-khalti',
      method: 'KHALTI',
      qrImageUrl: 'https://cdn/khalti.png',
      label: 'Khalti ID: 98XXXXXXXX',
      isActive: true,
    },
    {
      id: 'qr-bank',
      method: 'BANK',
      qrImageUrl: 'https://cdn/bank.png',
      label: 'Bank • A/C 01XXXX',
      isActive: false,
    },
  ];
  return {
    PlatformQrFactory: {
      create: () => ({
        listAll: async (_req: express.Request, res: express.Response) => {
          res.status(200).json({ success: true, data: rows });
        },
        listActive: async (_req: express.Request, res: express.Response) => {
          res.status(200).json({ success: true, data: rows.filter((r) => r.isActive) });
        },
        create: async (req: express.Request, res: express.Response) => {
          const created = { id: 'qr-new', ...(req.body ?? {}) };
          res
            .status(201)
            .json({ success: true, message: 'Platform QR created successfully', data: created });
        },
        update: async (req: express.Request, res: express.Response) => {
          res
            .status(200)
            .json({
              success: true,
              message: 'Platform QR updated successfully',
              data: { id: req.params.id, ...(req.body ?? {}) },
            });
        },
        remove: async (req: express.Request, res: express.Response) => {
          res
            .status(200)
            .json({
              success: true,
              message: 'Platform QR removed successfully',
              id: req.params.id,
            });
        },
      }),
    },
  };
});

const app = express();
app.use(express.json());
const routes = express.Router();
routes.use('/admin/platform-qrs', authenticate, requireRoles(IROLES.ADMIN), platformQrAdminRouter);
routes.use('/', platformQrPublicRouter);
app.use('/api/v1/hostel-ghar', routes);
app.use(notFoundHandler);

const adminToken = JwtTokenService.generateAccessToken({
  userId: '00000000-0000-0000-0000-000000000012',
  email: 'admin@test.local',
  role: IROLES.ADMIN,
});
const ownerToken = JwtTokenService.generateAccessToken({
  userId: '00000000-0000-0000-0000-000000000011',
  email: 'owner@test.local',
  role: IROLES.OWNER,
});
const residentToken = JwtTokenService.generateAccessToken({
  userId: '00000000-0000-0000-0000-000000000013',
  email: 'resident@test.local',
  role: IROLES.RESIDENT,
});

let server: Server;
let baseUrl: string;

const call = async (method: string, path: string, token: string | undefined, body?: unknown) => {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, body: await res.json() };
};

describe('admin platform-qr CRUD', () => {
  it('GET /admin/platform-qrs lists every configured QR (no longer 404)', async () => {
    const { status, body } = await call(
      'GET',
      '/api/v1/hostel-ghar/admin/platform-qrs',
      adminToken,
    );
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(3);
  });

  it('POST /admin/platform-qrs creates a QR (JSON url)', async () => {
    const { status, body } = await call(
      'POST',
      '/api/v1/hostel-ghar/admin/platform-qrs',
      adminToken,
      {
        method: 'ESEWA',
        label: 'eSewa ID: 98XXXXXXXX',
        qrImageUrl: 'https://cdn/esewa.png',
      },
    );
    expect(status).toBe(201);
    expect(body.data).toMatchObject({ method: 'ESEWA' });
  });

  it('PUT /admin/platform-qrs/:id replaces image/label', async () => {
    const { status, body } = await call(
      'PUT',
      '/api/v1/hostel-ghar/admin/platform-qrs/qr-esewa',
      adminToken,
      {
        method: 'ESEWA',
        label: 'updated label',
      },
    );
    expect(status).toBe(200);
    expect(body.data).toMatchObject({ id: 'qr-esewa' });
  });

  it('DELETE /admin/platform-qrs/:id removes a QR', async () => {
    const { status, body } = await call(
      'DELETE',
      '/api/v1/hostel-ghar/admin/platform-qrs/qr-esewa',
      adminToken,
    );
    expect(status).toBe(200);
    expect(body.id).toBe('qr-esewa');
  });

  it('rejects an invalid method with 422', async () => {
    const { status, body } = await call(
      'POST',
      '/api/v1/hostel-ghar/admin/platform-qrs',
      adminToken,
      {
        method: 'PAYPAL',
        label: 'nope',
      },
    );
    expect(status).toBe(422);
    expect(body.success).toBe(false);
  });

  it('requires authentication', async () => {
    const { status } = await call('GET', '/api/v1/hostel-ghar/admin/platform-qrs', undefined);
    expect(status).toBe(401);
  });

  it('forbids non-admin roles', async () => {
    const { status } = await call('GET', '/api/v1/hostel-ghar/admin/platform-qrs', ownerToken);
    expect(status).toBe(403);
  });
});

describe('owner active platform-qr read', () => {
  it('GET /platform-qrs returns only active QRs for owners', async () => {
    const { status, body } = await call('GET', '/api/v1/hostel-ghar/platform-qrs', ownerToken);
    expect(status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
    // BANK is inactive in the stub → filtered out.
    expect(body.data.every((r: { isActive: boolean }) => r.isActive)).toBe(true);
  });

  it('requires authentication', async () => {
    const { status } = await call('GET', '/api/v1/hostel-ghar/platform-qrs', undefined);
    expect(status).toBe(401);
  });

  it('forbids residents (only owners/admins pay)', async () => {
    const { status } = await call('GET', '/api/v1/hostel-ghar/platform-qrs', residentToken);
    expect(status).toBe(403);
  });
});

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
