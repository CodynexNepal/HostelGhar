import 'reflect-metadata';
import express from 'express';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { subscriptionRouter } from '../../src/routes/subscription/subscription.routes';
import { notFoundHandler } from '../../src/middleware/not-found.middleware';
import { JwtTokenService } from '../../src/utils/jwt-token.util';
import { IROLES } from '../../src/enum/roles.enum';

// Route-level checks for the payment-proof subscription workflow: the review
// queue and the approve/reject endpoint must be admin-only, and the upload
// middleware on /subscribe must not break plain JSON bodies. No DB is touched.
const app = express();
app.use(express.json());
const routes = express.Router();
routes.use('/subscriptions', subscriptionRouter);
app.use('/api/v1/hostel-ghar', routes);
app.use(notFoundHandler);

const HOSTEL_ID = 'a38bf07a-b7b1-49dc-85c8-dd5542a8e90a';
const REQUEST_ID = 'b2f4c9d1-4e5a-4f6b-9c7d-1e2f3a4b5c6d';

const ownerToken = JwtTokenService.generateAccessToken({
  userId: '00000000-0000-0000-0000-000000000011',
  email: 'owner@test.local',
  role: IROLES.OWNER,
});
const adminToken = JwtTokenService.generateAccessToken({
  userId: '00000000-0000-0000-0000-000000000012',
  email: 'admin@test.local',
  role: IROLES.ADMIN,
});

let server: Server;
let baseUrl: string;

interface HttpResult {
  status: number;
  body: { message?: string };
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
  return { status: res.status, body: (await res.json()) as { message?: string } };
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

describe('GET /subscriptions/requests (admin review queue)', () => {
  it('requires authentication', async () => {
    const { status } = await request('/api/v1/hostel-ghar/subscriptions/requests');
    expect(status).toBe(401);
  });

  it('forbids owners — only admins may review payment proofs', async () => {
    const { status } = await request('/api/v1/hostel-ghar/subscriptions/requests', {
      token: ownerToken,
    });
    expect(status).toBe(403);
  });

  it('forbids residents', async () => {
    const residentToken = JwtTokenService.generateAccessToken({
      userId: '00000000-0000-0000-0000-000000000013',
      email: 'resident@test.local',
      role: IROLES.RESIDENT,
    });
    const { status } = await request('/api/v1/hostel-ghar/subscriptions/requests', {
      token: residentToken,
    });
    expect(status).toBe(403);
  });
});

describe('POST /subscriptions/requests/:id/review', () => {
  it('forbids owners from approving their own upgrade', async () => {
    const { status } = await request(
      `/api/v1/hostel-ghar/subscriptions/requests/${REQUEST_ID}/review`,
      { token: ownerToken, method: 'POST', body: { action: 'APPROVE' } },
    );
    expect(status).toBe(403);
  });

  it('lets admins past the role gate and validates the DTO (422, no DB hit)', async () => {
    const { status, body } = await request(
      `/api/v1/hostel-ghar/subscriptions/requests/${REQUEST_ID}/review`,
      { token: adminToken, method: 'POST', body: { unexpected: true } },
    );
    expect(status).toBe(422);
    expect(String(body.message).toLowerCase()).toContain('validation');
  });
});

describe('POST /subscriptions/subscribe (payment-proof request)', () => {
  it('keeps the owner role gate and hostel validation intact', async () => {
    const { status } = await request('/api/v1/hostel-ghar/subscriptions/subscribe', {
      token: ownerToken,
      method: 'POST',
      body: { plan: 'PRO' },
    });
    // resolveHostelId runs before the DTO — no hostelId in body/header → 400.
    expect(status).toBe(400);
  });

  it('parses JSON bodies through the upload middleware (422 unknown plan)', async () => {
    const { status } = await request('/api/v1/hostel-ghar/subscriptions/subscribe', {
      token: ownerToken,
      method: 'POST',
      body: { plan: 'ENTERPRISE_TIER', hostelId: HOSTEL_ID },
    });
    expect(status).toBe(422);
  });
});
