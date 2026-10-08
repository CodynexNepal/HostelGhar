import 'reflect-metadata';
import express from 'express';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { notFoundHandler } from '../../src/middleware/not-found.middleware';
import { JwtTokenService } from '../../src/utils/jwt-token.util';
import { IROLES } from '../../src/enum/roles.enum';
import { authenticate, requireRoles } from '../../src/middleware/auth.middleware';

// Route-level checks for GET /admin/dashboard: the admin role gate must hold and
// `?refresh=1|true` must be translated into a cache-bypassing service call. The
// handler is stubbed, so no DB and no Redis are touched.
const getAdminDashboard = vi.fn().mockResolvedValue({
  data: { stats: { totalHostels: 1 }, pendingApprovals: { count: 0 } },
  isCached: false,
  cacheLevel: 'L3',
});

vi.mock('../../src/factory/analytics/analytics.factory', () => ({
  AnalyticsFactory: {
    create: () => ({ adminDashboard: handler, adminSummary: handler }),
  },
}));

const handler = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const { data, isCached, cacheLevel } = await getAdminDashboard({
      refresh: req.query.refresh === '1' || req.query.refresh === 'true',
    });
    res.status(200).json({ success: true, isCached, cacheLevel, data });
  } catch (error) {
    next(error);
  }
};

const app = express();
app.use(express.json());
const routes = express.Router();
routes.get(
  '/admin/dashboard',
  authenticate,
  requireRoles(IROLES.ADMIN),
  handler as express.RequestHandler,
);
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

const request = async (path: string, token?: string) => {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
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

describe('GET /admin/dashboard', () => {
  it('requires authentication', async () => {
    const { status } = await request('/api/v1/hostel-ghar/admin/dashboard');
    expect(status).toBe(401);
  });

  it('forbids non-admin roles', async () => {
    const { status } = await request('/api/v1/hostel-ghar/admin/dashboard', ownerToken);
    expect(status).toBe(403);
  });

  it('lets admins read the dashboard and serves the cache metadata', async () => {
    getAdminDashboard.mockClear();
    const { status, body } = await request('/api/v1/hostel-ghar/admin/dashboard', adminToken);
    expect(status).toBe(200);
    expect(body).toMatchObject({ success: true, cacheLevel: 'L3' });
    expect(getAdminDashboard).toHaveBeenCalledWith({ refresh: false });
  });

  it('turns ?refresh=1 and ?refresh=true into a cache-bypassing read', async () => {
    for (const query of ['?refresh=1', '?refresh=true']) {
      getAdminDashboard.mockClear();
      await request(`/api/v1/hostel-ghar/admin/dashboard${query}`, adminToken);
      expect(getAdminDashboard).toHaveBeenCalledWith({ refresh: true });
    }
  });

  it('ignores unrelated refresh values', async () => {
    getAdminDashboard.mockClear();
    await request('/api/v1/hostel-ghar/admin/dashboard?refresh=yes', adminToken);
    expect(getAdminDashboard).toHaveBeenCalledWith({ refresh: false });
  });
});
