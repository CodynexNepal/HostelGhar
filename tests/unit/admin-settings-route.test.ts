import 'reflect-metadata';
import express from 'express';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { notFoundHandler } from '../../src/middleware/not-found.middleware';
import { JwtTokenService } from '../../src/utils/jwt-token.util';
import { IROLES } from '../../src/enum/roles.enum';
import { authenticate, requireRoles } from '../../src/middleware/auth.middleware';
import { settingsRouter } from '../../src/routes/settings/settings.routes';

// Guards the admin settings endpoints the dashboard settings page calls:
// PUT /admin/settings/{general|billing|access|alerts|system} must exist,
// require admin, validate payloads via DTOs, and echo the merged section.
// The factory is stubbed so no DB/Redis is touched.
vi.mock('../../src/factory/settings/settings.factory', () => {
  const store: Record<string, Record<string, unknown>> = {
    general: { platformName: 'Hostel Ghar' },
    billing: { standardPlanPrice: 1500 },
    access: { allowPublicHostelSignup: true },
    alerts: { smsGatewayProvider: 'SPARROW_SMS' },
    system: { maintenanceMode: false },
  };
  return {
    SettingsFactory: {
      create: () => ({
        getAll: async (_req: express.Request, res: express.Response) => {
          res.status(200).json({ success: true, data: store });
        },
        getSection: async (req: express.Request, res: express.Response) => {
          const section = String(req.params.section || '').toLowerCase();
          if (!store[section]) {
            res.status(400).json({
              success: false,
              message: `Unknown settings section "${req.params.section}"`,
            });
            return;
          }
          res.status(200).json({ success: true, data: store[section] });
        },
        updateSection: (section: string) => async (req: express.Request, res: express.Response) => {
          store[section] = { ...store[section], ...(req.body ?? {}) };
          res.status(200).json({
            success: true,
            message: `${section} settings updated successfully`,
            data: store[section],
          });
        },
      }),
    },
  };
});

const app = express();
app.use(express.json());
const routes = express.Router();
routes.use('/admin/settings', authenticate, requireRoles(IROLES.ADMIN), settingsRouter);
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

let server: Server;
let baseUrl: string;

const put = async (path: string, token: string | undefined, body: unknown) => {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
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

describe('PUT /admin/settings/:section', () => {
  const cases: Array<[string, Record<string, unknown>]> = [
    ['general', { platformName: 'Hostel Ghar', currency: 'NPR' }],
    ['billing', { standardPlanPrice: 1500, gracePeriodDays: 3 }],
    ['access', { allowPublicHostelSignup: true, sessionLifetimeDays: 14 }],
    ['alerts', { smsGatewayProvider: 'SPARROW_SMS', overdueAlertThreshold: 25000 }],
    ['system', { maintenanceMode: false }],
  ];

  it.each(cases)('updates the %s section instead of 404', async (section, payload) => {
    const { status, body } = await put(
      `/api/v1/hostel-ghar/admin/settings/${section}`,
      adminToken,
      payload,
    );
    expect(status).toBe(200);
    expect(body).toMatchObject({ success: true, data: payload });
  });

  it('requires authentication', async () => {
    const { status } = await put('/api/v1/hostel-ghar/admin/settings/general', undefined, {
      platformName: 'Hostel Ghar',
    });
    expect(status).toBe(401);
  });

  it('forbids non-admin roles', async () => {
    const { status } = await put('/api/v1/hostel-ghar/admin/settings/general', ownerToken, {
      platformName: 'Hostel Ghar',
    });
    expect(status).toBe(403);
  });

  it('rejects invalid payloads with 422', async () => {
    const { status, body } = await put('/api/v1/hostel-ghar/admin/settings/billing', adminToken, {
      standardPlanPrice: 'expensive',
    });
    expect(status).toBe(422);
    expect(body.success).toBe(false);
  });
});
